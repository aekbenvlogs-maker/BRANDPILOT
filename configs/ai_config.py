# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : configs/ai_config.py
# DESCRIPTION  : AI provider configuration and OpenAI-compatible client factory
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from loguru import logger
from openai import AsyncOpenAI

from configs.settings import get_settings


# ---------------------------------------------------------------------------
# Data classes for AI configuration
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ModelConfig:
    """
    Configuration for a specific AI model.

    Attributes:
        name:         Model identifier string (e.g. 'gpt-4-turbo-preview').
        max_tokens:   Maximum output tokens per request.
        temperature:  Sampling temperature (0.0 = deterministic, 2.0 = creative).
        top_p:        Nucleus sampling parameter.
        system_prompt: Default system prompt prefix for this model.
    """

    name: str
    max_tokens: int = 2048
    temperature: float = 0.7
    top_p: float = 1.0
    system_prompt: str = (
        "You are BRANDSCALE, an expert AI marketing specialist. "
        "Produce professional, persuasive marketing content tailored to the audience. "
        "Always respond in the language of the request."
    )


@dataclass
class AIUsageRecord:
    """
    Tracks token usage and cost for a single AI API call.

    Used for analytics and cost monitoring dashboard.
    """

    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float = field(init=False)

    # Approximate cost per 1K tokens (updated 2026-03)
    _COST_PER_1K: dict[str, float] = field(
        default_factory=lambda: {
            "gpt-4-turbo-preview": 0.01,
            "gpt-4o": 0.005,
            "gpt-3.5-turbo": 0.0005,
            "default": 0.002,
        }
    )

    def __post_init__(self) -> None:
        """Calculate estimated cost after initialization."""
        rate = self._COST_PER_1K.get(self.model, self._COST_PER_1K["default"])
        self.estimated_cost_usd = (self.total_tokens / 1000) * rate


# ---------------------------------------------------------------------------
# Per-model pricing (input + output, USD per 1K tokens — updated 2026-03)
# ---------------------------------------------------------------------------
MODEL_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o":            {"input": 0.005,   "output": 0.015},
    "gpt-4-turbo-preview": {"input": 0.010, "output": 0.030},
    "gpt-4-turbo":       {"input": 0.010,   "output": 0.030},
    "gpt-3.5-turbo":     {"input": 0.0005,  "output": 0.0015},
    "gpt-4o-mini":       {"input": 0.00015, "output": 0.0006},
    "ollama/local":      {"input": 0.0,     "output": 0.0},
}


def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """
    Compute the real cost of an API call based on model-specific pricing.

    Args:
        model:         Model identifier string.
        input_tokens:  Number of prompt tokens.
        output_tokens: Number of completion tokens.

    Returns:
        Estimated cost in USD.
    """
    pricing = MODEL_PRICING.get(model, {"input": 0.01, "output": 0.01})
    return (input_tokens / 1000) * pricing["input"] + (
        output_tokens / 1000
    ) * pricing["output"]


# ---------------------------------------------------------------------------
# Preset model configurations for different content types
# ---------------------------------------------------------------------------
CONTENT_MODELS: dict[str, ModelConfig] = {
    "post": ModelConfig(
        name=get_settings().openai_model,
        max_tokens=512,
        temperature=0.8,
        system_prompt=(
            "You are BRANDSCALE, a social media marketing expert. "
            "Write engaging, platform-appropriate posts with strong calls-to-action."
        ),
    ),
    "email": ModelConfig(
        name=get_settings().openai_model,
        max_tokens=1024,
        temperature=0.65,
        system_prompt=(
            "You are BRANDSCALE, an email marketing specialist. "
            "Write persuasive, personalised emails with clear subject lines and CTAs."
        ),
    ),
    "ad": ModelConfig(
        name=get_settings().openai_model,
        max_tokens=256,
        temperature=0.9,
        system_prompt=(
            "You are BRANDSCALE, a copywriting expert for digital advertising. "
            "Write concise, high-converting ad copy within character limits."
        ),
    ),
    "newsletter": ModelConfig(
        name=get_settings().openai_model,
        max_tokens=2048,
        temperature=0.7,
    ),
    "video_script": ModelConfig(
        name=get_settings().openai_model,
        max_tokens=1500,
        temperature=0.75,
        system_prompt=(
            "You are BRANDSCALE, a video script writer for marketing content. "
            "Write clear, engaging scripts with scenes, narrator text and timing cues."
        ),
    ),
    "scoring": ModelConfig(
        name=get_settings().openai_model,
        max_tokens=512,
        temperature=0.1,  # low temperature for deterministic JSON output
        system_prompt=(
            "You are BRANDSCALE, a lead scoring expert. "
            "Analyse lead data and return a JSON score breakdown. "
            "Always respond with valid JSON only."
        ),
    ),
}


# ---------------------------------------------------------------------------
# Fallback templates when AI API is unavailable
# ---------------------------------------------------------------------------
FALLBACK_TEMPLATES: dict[str, str] = {
    "post": (
        "🚀 Découvrez {product} — la solution qui transforme votre marketing. "
        "Contactez-nous dès aujourd'hui ! #BRANDSCALE #Marketing"
    ),
    "email": (
        "Bonjour {first_name},\n\n"
        "Nous souhaitons vous présenter {product}.\n\n"
        "Pour en savoir plus, répondez à cet email.\n\n"
        "Cordialement,\nL'équipe BRANDSCALE\n\n"
        "---\nSe désinscrire : {unsubscribe_link}"
    ),
    "ad": "Découvrez {product} — Résultats garantis. Cliquez maintenant.",
    "newsletter": (
        "# Bonjour {first_name},\n\n"
        "Voici les dernières actualités de {brand}.\n\n"
        "{content_placeholder}"
    ),
    "video_script": (
        "[SCÈNE 1 — 0:00-0:05]\n"
        "Narrateur : Vous cherchez à développer votre marque ?\n\n"
        "[SCÈNE 2 — 0:05-0:15]\n"
        "Narrateur : Découvrez {product}, la solution BRANDSCALE.\n"
    ),
}


# ---------------------------------------------------------------------------
# AsyncOpenAI client factory
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    """
    Return a cached AsyncOpenAI client configured from settings.

    The client supports any OpenAI-compatible API by overriding
    the base_url (e.g. for Claude, Mistral, or local Ollama).

    Returns:
        Configured AsyncOpenAI instance.
    """
    settings = get_settings()

    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        timeout=60.0,
        max_retries=2,
    )

    logger.info(
        "[BRANDSCALE] AI client initialised | model={} | base_url={}",
        settings.openai_model,
        settings.openai_base_url,
    )

    return client


def get_local_client() -> AsyncOpenAI:
    """
    Return an AsyncOpenAI client pointed at the local Ollama instance.

    Returns:
        AsyncOpenAI configured for Ollama.
    """
    settings = get_settings()

    return AsyncOpenAI(
        api_key="ollama",  # Ollama ignores API key
        base_url=f"{settings.ollama_base_url}/v1",
        timeout=120.0,
        max_retries=1,
    )


def get_model_config(content_type: str) -> ModelConfig:
    """
    Return the ModelConfig for the given content type.

    Falls back to a default config if the type is unknown.

    Args:
        content_type: One of post, email, ad, newsletter, video_script, scoring.

    Returns:
        ModelConfig for the requested content type.
    """
    config = CONTENT_MODELS.get(content_type)
    if config is None:
        logger.warning(
            "[BRANDSCALE] Unknown content type '{}' — using default model config.",
            content_type,
        )
        settings = get_settings()
        return ModelConfig(name=settings.openai_model)
    return config


def get_fallback_template(content_type: str, **kwargs: Any) -> str:
    """
    Return a formatted fallback template string when AI is unavailable.

    Args:
        content_type: Type of content to fall back to.
        **kwargs:     Template variables to substitute.

    Returns:
        Formatted fallback string.
    """
    template = FALLBACK_TEMPLATES.get(content_type, "Content generation unavailable.")
    try:
        return template.format(**kwargs)
    except KeyError:
        # Return raw template if variables are missing
        return template


if __name__ == "__main__":
    settings = get_settings()
    print(f"[BRANDSCALE] AI model: {settings.openai_model}")
    print(f"[BRANDSCALE] Fallback to local: {settings.ai_fallback_to_local}")
    for ctype, config in CONTENT_MODELS.items():
        print(f"  {ctype}: {config.name} | max_tokens={config.max_tokens}")
