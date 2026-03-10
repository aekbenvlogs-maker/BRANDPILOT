# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/campaign_agent/intent_parser.py
# Extracts structured CampaignIntent from a natural-language prompt via GPT-4.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field

from loguru import logger
from openai import APITimeoutError

from backend.exceptions import BrandpilotError
from configs.ai_config import get_openai_client, get_settings

# ---------------------------------------------------------------------------
# Minimum number of fields that must be detected to consider the prompt valid.
# ---------------------------------------------------------------------------
_MIN_EXTRACTED_FIELDS: int = 3

# ---------------------------------------------------------------------------
# Questions asked back to the user when the prompt is too vague.
# Keyed by field name — only shown when that field was NOT extracted.
# ---------------------------------------------------------------------------
_CLARIFICATION_QUESTIONS: dict[str, str] = {
    "product_description": "Quel produit ou service souhaitez-vous promouvoir ?",
    "platform": (
        "Sur quelle(s) plateforme(s) souhaitez-vous diffuser ? "
        "(Instagram, TikTok, YouTube, X, multi)"
    ),
    "objective": (
        "Quel est votre objectif principal ? "
        "(notoriété, conversion, engagement)"
    ),
    "audience_age": "Quelle tranche d'âge ciblez-vous ? (ex. 25-35)",
    "audience_gender": "Quel genre ciblez-vous ? (femmes, hommes, tous)",
}

# ---------------------------------------------------------------------------
# System prompt — instructs GPT-4 to act as a pure JSON intent extractor.
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """\
You are a campaign intent parser for the BRANDPILOT marketing platform.
Extract structured campaign parameters from a natural language prompt and \
return ONLY a valid JSON object — no explanation, no markdown, no extra text.

## OUTPUT JSON SCHEMA
{
  "platform": "multi",
  "audience_age": "all",
  "audience_gender": "all",
  "audience_csp": "all",
  "budget_influencer": 0.0,
  "duration_days": 14,
  "objective": "awareness",
  "product_description": "",
  "tone_override": null,
  "extracted_fields": []
}

## FIELD DESCRIPTIONS
- platform           : "instagram"|"tiktok"|"youtube"|"x"|"multi"
- audience_age       : age range string, e.g. "18-25", "25-35", "35-50", or "all"
- audience_gender    : "female"|"male"|"all"
- audience_csp       : "csp+"|"standard"|"all"
- budget_influencer  : numeric budget in EUR (float, 0.0 if not mentioned)
- duration_days      : campaign duration in days (integer, default 14)
- objective          : "awareness"|"conversion"|"engagement"
- product_description: short description of the product or service
- tone_override      : "energetic"|"professional"|"inspirational" or null
- extracted_fields   : list of field names you explicitly extracted from the prompt

## SEMANTIC MAPPINGS
- "femmes", "féminin"              → audience_gender = "female"
- "hommes", "masculin"             → audience_gender = "male"
- "CSP+", "cadres", "hauts revenus"→ audience_csp = "csp+"
- "étudiants", "jeunes"            → audience_age = "18-25"
- "booster les ventes", "ROI"      → objective = "conversion"
- "notoriété", "visibilité"        → objective = "awareness"
- "engagement", "communauté"       → objective = "engagement"
- "ton jeune", "dynamique", "fun"  → tone_override = "energetic"
- "professionnel", "B2B"           → tone_override = "professional"
- "inspirant", "lifestyle"         → tone_override = "inspirational"

## RULES
1. Use default values for fields NOT mentioned in the prompt.
2. Add a field name to "extracted_fields" ONLY if explicitly mentioned or
   clearly implied by the prompt — never inflate this list.
3. Never invent data that is not present in the prompt.
4. Always return valid JSON and nothing else.

## EXAMPLES
Prompt: "campagne Instagram sac cuir femmes 25-35 budget 500€"
Output: {
  "platform": "instagram", "audience_age": "25-35", "audience_gender": "female",
  "audience_csp": "all", "budget_influencer": 500.0, "duration_days": 14,
  "objective": "awareness", "product_description": "sac en cuir",
  "tone_override": null,
  "extracted_fields": ["platform", "audience_age", "audience_gender",
                       "budget_influencer", "product_description"]
}

Prompt: "TikTok notoriété 18-25 ton dynamique énergie naturelle 30 jours"
Output: {
  "platform": "tiktok", "audience_age": "18-25", "audience_gender": "all",
  "audience_csp": "all", "budget_influencer": 0.0, "duration_days": 30,
  "objective": "awareness", "product_description": "énergie naturelle",
  "tone_override": "energetic",
  "extracted_fields": ["platform", "audience_age", "duration_days",
                       "product_description", "tone_override"]
}
"""


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class AmbiguousPromptError(BrandpilotError):
    """Raised when the prompt does not contain enough information.

    Attributes:
        questions: List of clarification questions to present to the user.

    Example:
        >>> raise AmbiguousPromptError(questions=["Sur quelle plateforme ?"])
    """

    def __init__(self, questions: list[str]) -> None:
        """Initialise with a list of clarification questions.

        Args:
            questions: Non-empty list of questions to send back to the user.
        """
        super().__init__(
            message=(
                "Le prompt est trop vague. "
                f"Questions de clarification : {questions}"
            ),
            code="AMBIGUOUS_PROMPT",
        )
        self.questions = questions


class IntentParseError(BrandpilotError):
    """Raised when GPT-4 returns a response that cannot be parsed as valid JSON.

    Attributes:
        raw_response: The raw string returned by the model.

    Example:
        >>> raise IntentParseError(raw_response="Sorry, I can't help with that.")
    """

    def __init__(self, raw_response: str) -> None:
        """Initialise with the raw model response.

        Args:
            raw_response: The raw text returned by the model.
        """
        super().__init__(
            message=(
                "La réponse du modèle n'est pas un JSON valide. "
                f"Réponse brute : {raw_response[:200]!r}"
            ),
            code="INTENT_PARSE_ERROR",
        )
        self.raw_response = raw_response


class OpenAITimeoutError(BrandpilotError):
    """Raised when the GPT-4 API call exceeds the 10-second timeout.

    Example:
        >>> raise OpenAITimeoutError()
    """

    def __init__(self) -> None:
        super().__init__(
            message="L'appel à l'API OpenAI a dépassé le délai de 10 secondes.",
            code="OPENAI_TIMEOUT",
        )


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class CampaignIntent:
    """Structured representation of a campaign extracted from a natural-language prompt.

    All fields have sensible defaults so that partial prompts can still
    produce a valid object — missing fields simply keep their default value.

    Attributes:
        platform:            Target social platform.
        audience_age:        Age range string (e.g. "25-35") or "all".
        audience_gender:     Target gender: "female", "male", or "all".
        audience_csp:        Socio-professional category: "csp+", "standard", or "all".
        budget_influencer:   Influencer budget in EUR.
        duration_days:       Campaign duration in calendar days.
        objective:           Marketing objective: "awareness", "conversion", or "engagement".
        product_description: Short description of the promoted product or service.
        tone_override:       Optional tone directive overriding brand defaults.

    Example:
        >>> intent = CampaignIntent(
        ...     platform="instagram",
        ...     audience_gender="female",
        ...     audience_age="25-35",
        ...     budget_influencer=500.0,
        ...     product_description="sac en cuir premium",
        ... )
    """

    platform: str = "multi"
    audience_age: str = "all"
    audience_gender: str = "all"
    audience_csp: str = "all"
    budget_influencer: float = 0.0
    duration_days: int = 14
    objective: str = "awareness"
    product_description: str = ""
    tone_override: str | None = None

    # Internal — not part of the public API.
    _extracted_fields: list[str] = field(default_factory=list, repr=False)


# ---------------------------------------------------------------------------
# Default values used to count extracted fields.
# ---------------------------------------------------------------------------
_DEFAULTS: dict[str, object] = {
    "platform": "multi",
    "audience_age": "all",
    "audience_gender": "all",
    "audience_csp": "all",
    "budget_influencer": 0.0,
    "duration_days": 14,
    "objective": "awareness",
    "product_description": "",
    "tone_override": None,
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_clarification_questions(extracted: list[str]) -> list[str]:
    """Build a list of clarification questions for fields missing from the prompt.

    Only asks about the most important fields (defined in
    ``_CLARIFICATION_QUESTIONS``) that were not extracted.

    Args:
        extracted: Field names that GPT-4 successfully extracted.

    Returns:
        List of human-readable questions. May be empty if all key fields
        were extracted.
    """
    return [
        question
        for field_name, question in _CLARIFICATION_QUESTIONS.items()
        if field_name not in extracted
    ]


def _parse_raw_json(raw: str, prompt: str) -> dict[str, object]:
    """Attempt to parse raw GPT-4 output as a JSON dict.

    Args:
        raw:    Raw string returned by the model.
        prompt: Original user prompt (used only for logging).

    Returns:
        Parsed dictionary.

    Raises:
        IntentParseError: If the string is not valid JSON or not a dict.
    """
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error(
            "[CampaignAgent] JSON decode failed | prompt={!r} raw={!r} error={}",
            prompt[:80],
            raw[:200],
            exc,
        )
        raise IntentParseError(raw_response=raw) from exc

    if not isinstance(data, dict):
        raise IntentParseError(raw_response=raw)

    return data  # type: ignore[return-value]


def _dict_to_intent(data: dict[str, object]) -> CampaignIntent:
    """Convert a validated dictionary to a ``CampaignIntent`` dataclass.

    Unknown keys are silently ignored. Type coercions (e.g. float for budget)
    are applied defensively.

    Args:
        data: Dictionary produced by ``_parse_raw_json``.

    Returns:
        Populated ``CampaignIntent`` instance.
    """
    extracted: list[str] = list(data.get("extracted_fields", []))  # type: ignore[arg-type]

    return CampaignIntent(
        platform=str(data.get("platform", _DEFAULTS["platform"])),
        audience_age=str(data.get("audience_age", _DEFAULTS["audience_age"])),
        audience_gender=str(data.get("audience_gender", _DEFAULTS["audience_gender"])),
        audience_csp=str(data.get("audience_csp", _DEFAULTS["audience_csp"])),
        budget_influencer=float(data.get("budget_influencer", _DEFAULTS["budget_influencer"])),  # type: ignore[arg-type]
        duration_days=int(data.get("duration_days", _DEFAULTS["duration_days"])),  # type: ignore[arg-type]
        objective=str(data.get("objective", _DEFAULTS["objective"])),
        product_description=str(data.get("product_description", _DEFAULTS["product_description"])),
        tone_override=(
            str(data["tone_override"])
            if data.get("tone_override") is not None
            else None
        ),
        _extracted_fields=extracted,
    )


async def _call_gpt4(prompt: str) -> str:
    """Perform the actual OpenAI API call with a strict 10-second timeout.

    Args:
        prompt: The raw user prompt to parse.

    Returns:
        Raw content string from the model's first choice.

    Raises:
        OpenAITimeoutError: If the API call exceeds 10 seconds.
        IntentParseError:   If the model returns an empty response.
    """
    client = get_openai_client()
    settings = get_settings()

    logger.debug("[CampaignAgent] Calling GPT-4 | prompt={!r}", prompt[:120])

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.openai_model,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            ),
            timeout=10.0,
        )
    except (asyncio.TimeoutError, APITimeoutError) as exc:
        logger.error(
            "[CampaignAgent] GPT-4 timeout after 10s | prompt={!r}", prompt[:80]
        )
        raise OpenAITimeoutError() from exc

    raw = response.choices[0].message.content or ""
    if not raw.strip():
        raise IntentParseError(raw_response="<empty response>")

    logger.debug(
        "[CampaignAgent] GPT-4 raw response | tokens={} raw={!r}",
        response.usage.total_tokens if response.usage else "?",
        raw[:200],
    )
    return raw


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def parse_intent(prompt: str) -> CampaignIntent:
    """Extract a structured ``CampaignIntent`` from a natural-language prompt.

    Uses GPT-4 in strict JSON mode (temperature=0.0) to deterministically
    map free-form text to campaign parameters. Raises ``AmbiguousPromptError``
    when fewer than three fields can be reliably extracted.

    Args:
        prompt: Natural-language campaign brief written by the user.
                Must be a non-empty string.

    Returns:
        ``CampaignIntent`` dataclass populated with extracted values.
        Fields absent from the prompt keep their documented defaults.

    Raises:
        AmbiguousPromptError: Fewer than 3 campaign fields were detected.
                              The exception carries a ``questions`` list the
                              caller should surface to the user.
        IntentParseError:     GPT-4 returned malformed JSON or an empty response.
        OpenAITimeoutError:   The API call exceeded the 10-second timeout.
        ValueError:           ``prompt`` is an empty string.

    Example:
        >>> intent = await parse_intent(
        ...     "campagne Instagram sac cuir femmes 25-35 budget 500€"
        ... )
        >>> assert intent.platform == "instagram"
        >>> assert intent.audience_gender == "female"
        >>> assert intent.budget_influencer == 500.0

        >>> await parse_intent("lance une campagne")
        # Raises AmbiguousPromptError(questions=["Sur quelle(s) plateforme(s)...",
        #                                        "Quel est votre objectif ?", ...])
    """
    if not prompt.strip():
        raise ValueError("Le prompt ne peut pas être vide.")

    logger.info("[CampaignAgent] parse_intent called | prompt={!r}", prompt[:120])

    raw = await _call_gpt4(prompt)
    data = _parse_raw_json(raw, prompt)
    intent = _dict_to_intent(data)

    logger.info(
        "[CampaignAgent] Extracted {} field(s): {}",
        len(intent._extracted_fields),
        intent._extracted_fields,
    )

    if len(intent._extracted_fields) < _MIN_EXTRACTED_FIELDS:
        questions = _build_clarification_questions(intent._extracted_fields)
        logger.warning(
            "[CampaignAgent] Prompt too vague ({} fields) — raising AmbiguousPromptError | questions={}",
            len(intent._extracted_fields),
            questions,
        )
        raise AmbiguousPromptError(questions=questions)

    logger.success(
        "[CampaignAgent] Intent parsed | platform={} objective={} product={!r}",
        intent.platform,
        intent.objective,
        intent.product_description,
    )
    return intent
