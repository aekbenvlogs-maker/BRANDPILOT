# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/text_formatter.py
# DESCRIPTION  : Platform-specific text formatting utilities
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import unicodedata
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Unicode bold / italic conversion maps (Mathematical Alphanumeric Symbols)
# ---------------------------------------------------------------------------

_BOLD_MAP = {
    **{chr(ord('a') + i): chr(0x1D41A + i) for i in range(26)},
    **{chr(ord('A') + i): chr(0x1D400 + i) for i in range(26)},
    **{chr(ord('0') + i): chr(0x1D7CE + i) for i in range(10)},
}

_ITALIC_MAP = {
    **{chr(ord('a') + i): chr(0x1D44E + i) for i in range(26)},
    **{chr(ord('A') + i): chr(0x1D434 + i) for i in range(26)},
}


def bold_unicode(text: str) -> str:
    """Convert ASCII letters/digits to Unicode bold variants."""
    return "".join(_BOLD_MAP.get(c, c) for c in text)


def italic_unicode(text: str) -> str:
    """Convert ASCII letters to Unicode italic variants."""
    return "".join(_ITALIC_MAP.get(c, c) for c in text)


# ---------------------------------------------------------------------------
# Instagram formatting
# ---------------------------------------------------------------------------

def add_instagram_line_breaks(text: str) -> str:
    """
    Add Instagram-style line breaks: double newlines between paragraphs,
    with a zero-width space to preserve blank lines when rendered.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    return "\n\u200b\n".join(paragraphs)


# ---------------------------------------------------------------------------
# Character counting
# ---------------------------------------------------------------------------

_PLATFORM_LIMITS = {
    "instagram": 2200,
    "tiktok":    2200,
    "youtube":   5000,
    "x":         280,
    "linkedin":  3000,
    "facebook":  63206,
}


@dataclass
class CharCount:
    platform: str
    character_count: int
    limit: int
    remaining: int
    over_limit: bool


def count_characters(text: str, platform: str) -> CharCount:
    """
    Count characters in text with platform-specific limit.

    X counts URLs as 23 chars regardless of length.
    """
    if platform == "x":
        import re
        url_pattern = r"https?://\S+"
        clean = re.sub(url_pattern, "x" * 23, text)
        count = len(clean)
    else:
        count = len(text)

    limit = _PLATFORM_LIMITS.get(platform, 2000)
    return CharCount(
        platform=platform,
        character_count=count,
        limit=limit,
        remaining=limit - count,
        over_limit=count > limit,
    )


# ---------------------------------------------------------------------------
# X thread splitter
# ---------------------------------------------------------------------------

def split_into_thread(text: str, max_chars: int = 280) -> list[str]:
    """
    Split a long text into a numbered X thread.

    Args:
        text:      Full text to split.
        max_chars: Maximum characters per tweet (default 280).

    Returns:
        List of tweet strings with numbering suffix (e.g. "1/5").
    """
    words = text.split()
    tweets: list[str] = []
    current: list[str] = []

    for word in words:
        candidate = " ".join(current + [word])
        # Reserve 5 chars for " X/X" suffix
        if len(candidate) > max_chars - 5:
            if current:
                tweets.append(" ".join(current))
            current = [word]
        else:
            current.append(word)

    if current:
        tweets.append(" ".join(current))

    total = len(tweets)
    return [f"{tweet} {i + 1}/{total}" for i, tweet in enumerate(tweets)]
