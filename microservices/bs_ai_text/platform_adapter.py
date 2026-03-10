# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/bs_ai_text/platform_adapter.py
# Platform-specific style parameters for AI text generation.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from loguru import logger

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PlatformParams:
    """Style and constraint parameters for a specific social platform.

    Attributes:
        platform:           Normalised platform identifier.
        max_chars:          Hard character limit (0 = unlimited).
        hashtag_count:      Recommended number of hashtags to generate.
        emoji_density:      Emoji usage level: "high" | "medium" | "low" | "none".
        style:              Primary writing style for this platform.
        tone_instructions:  Extra system-prompt instructions injected verbatim.
    """

    platform: str
    max_chars: int
    hashtag_count: int
    emoji_density: str
    style: str
    tone_instructions: str


# ---------------------------------------------------------------------------
# Platform definitions
# ---------------------------------------------------------------------------

_PLATFORM_REGISTRY: Final[dict[str, PlatformParams]] = {
    "instagram": PlatformParams(
        platform="instagram",
        max_chars=2200,
        hashtag_count=30,
        emoji_density="high",
        style="storytelling",
        tone_instructions=(
            "Write an engaging Instagram caption using storytelling. "
            "Start with a strong hook in the first line (visible before 'more'). "
            "Use line breaks for readability. "
            "Add emojis naturally throughout. "
            "End with a clear call to action. "
            "Provide 30 relevant hashtags separated by spaces."
        ),
    ),
    "tiktok": PlatformParams(
        platform="tiktok",
        max_chars=300,
        hashtag_count=10,
        emoji_density="medium",
        style="hook_cta",
        tone_instructions=(
            "Write a punchy TikTok caption under 300 characters. "
            "Start with a curiosity hook. "
            "Use 1-2 emojis maximum. "
            "End with a direct CTA ('Follow for more', 'Link in bio', etc.). "
            "Include 10 trending hashtags on a new line."
        ),
    ),
    "youtube": PlatformParams(
        platform="youtube",
        max_chars=5000,
        hashtag_count=0,
        emoji_density="low",
        style="seo",
        tone_instructions=(
            "Write an SEO-optimised YouTube video description. "
            "First 2-3 lines must summarise the video (shown before 'Show more'). "
            "Include natural keyword density (no stuffing). "
            "Add timestamps if applicable. "
            "Use a friendly but authoritative tone. "
            "No hashtags — YouTube SEO uses keyword-rich prose instead."
        ),
    ),
    "x": PlatformParams(
        platform="x",
        max_chars=240,
        hashtag_count=3,
        emoji_density="low",
        style="punchline",
        tone_instructions=(
            "Write a punchy X (Twitter) post under 240 characters. "
            "One idea per post — no filler words. "
            "Use a strong opinion, stat, or insight as the hook. "
            "At most 1 emoji. "
            "End with at most 3 relevant hashtags."
        ),
    ),
    "linkedin": PlatformParams(
        platform="linkedin",
        max_chars=3000,
        hashtag_count=5,
        emoji_density="none",
        style="professional",
        tone_instructions=(
            "Write a professional LinkedIn post. "
            "Open with a bold statement or industry insight. "
            "Use short paragraphs (2-3 lines each). "
            "No emojis. "
            "Speak B2B — address decision-makers and practitioners. "
            "Close with a thought-provoking question to drive comments. "
            "Add 5 relevant professional hashtags at the end."
        ),
    ),
    "email": PlatformParams(
        platform="email",
        max_chars=0,
        hashtag_count=0,
        emoji_density="none",
        style="professional",
        tone_instructions=(
            "Write marketing email copy in a direct, professional tone. "
            "Subject line: under 60 characters, curiosity-driven. "
            "Body: short paragraphs, benefit-focused, one CTA button per email. "
            "No hashtags. No emojis. "
            "Always include an unsubscribe reminder sentence at the bottom."
        ),
    ),
}

# Fallback for unknown platforms
_DEFAULT_PARAMS = PlatformParams(
    platform="generic",
    max_chars=1000,
    hashtag_count=5,
    emoji_density="low",
    style="professional",
    tone_instructions=(
        "Write clear, concise marketing copy adapted to the audience. "
        "Be direct, benefit-focused, and include a call to action."
    ),
)


# ---------------------------------------------------------------------------
# PlatformAdapter
# ---------------------------------------------------------------------------


class PlatformAdapter:
    """Resolves per-platform generation parameters for the text service.

    Example:
        >>> adapter = PlatformAdapter()
        >>> params = adapter.get_params("instagram")
        >>> params.max_chars
        2200
    """

    def get_params(self, platform: str) -> PlatformParams:
        """Return style parameters for the given platform.

        Unknown platforms are mapped to a safe default and a warning is logged.

        Args:
            platform: Case-insensitive platform name (e.g. "instagram", "tiktok").

        Returns:
            PlatformParams for the platform, or default params if unknown.
        """
        key = platform.lower().strip()
        params = _PLATFORM_REGISTRY.get(key)
        if params is None:
            logger.warning(
                "[bs_ai_text/platform_adapter] Unknown platform '{}' — using defaults.",
                platform,
            )
            return _DEFAULT_PARAMS
        return params

    def is_within_limit(self, text: str, platform: str) -> bool:
        """Check whether *text* fits within the platform's character limit.

        Args:
            text:     The generated caption / body text.
            platform: Target platform identifier.

        Returns:
            True if within limit (or platform has no limit), False otherwise.
        """
        params = self.get_params(platform)
        if params.max_chars == 0:
            return True
        return len(text) <= params.max_chars

    def truncate_to_limit(self, text: str, platform: str) -> str:
        """Hard-truncate *text* to the platform character limit.

        Args:
            text:     Text that may exceed the platform limit.
            platform: Target platform identifier.

        Returns:
            Truncated text ending with '…' if it was over the limit.
        """
        params = self.get_params(platform)
        if params.max_chars == 0 or len(text) <= params.max_chars:
            return text
        truncated = text[: params.max_chars - 1].rstrip() + "…"
        logger.info(
            "[bs_ai_text/platform_adapter] Truncated text | platform={} from={} to={}",
            platform,
            len(text),
            len(truncated),
        )
        return truncated

    @staticmethod
    def supported_platforms() -> list[str]:
        """Return the list of natively supported platform identifiers.

        Returns:
            Sorted list of platform name strings.
        """
        return sorted(_PLATFORM_REGISTRY.keys())
