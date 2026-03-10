# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/service.py
# DESCRIPTION  : Content formatting orchestration service
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from loguru import logger

from microservices.bs_content_formatter.adaptive_writer import rewrite_for_platform
from microservices.bs_content_formatter.text_formatter import (
    add_instagram_line_breaks,
    count_characters,
    split_into_thread,
    bold_unicode,
)
from microservices.bs_content_formatter.hashtag_engine import generate_hashtags
from microservices.bs_content_formatter.grid_maker import create_instagram_grid, GridType
from microservices.bs_content_formatter.image_resizer import resize_to_formats


@dataclass
class FormattedContent:
    platform: str
    text: str
    hashtags: list[str]
    char_count: int
    over_limit: bool
    thread: list[str] | None = None
    notes: list[str] | None = None


@dataclass
class ImagePackage:
    original_format: str
    resized: dict[str, bytes]
    grid_tiles: list[bytes] | None = None


# ---------------------------------------------------------------------------
# Text pipeline
# ---------------------------------------------------------------------------

async def format_content_for_platform(
    content: str,
    source_platform: str,
    target_platform: str,
    niche: str = "general",
    hashtag_count: int = 30,
    brand_data: dict | None = None,
) -> FormattedContent:
    """
    Full text-formatting pipeline: rewrite → format → hashtags.

    Args:
        content:         Raw content text.
        source_platform: Original platform the content was written for.
        target_platform: Target platform to format for.
        niche:           Content niche for hashtag generation.
        hashtag_count:   Number of hashtags to generate.
        brand_data:      Optional brand tone/style context.

    Returns:
        FormattedContent with adapted text, hashtags and char count.
    """
    logger.info("Formatting content from {} → {}", source_platform, target_platform)

    # Step 1: Rewrite
    rewritten = await rewrite_for_platform(
        content=content,
        source_platform=source_platform,
        target_platform=target_platform,
        brand_data=brand_data,
    )

    # Step 2: Platform-specific post-processing
    notes: list[str] = []
    thread: list[str] | None = None

    if target_platform == "instagram":
        rewritten = add_instagram_line_breaks(rewritten)

    elif target_platform == "x":
        char_info = count_characters(rewritten, "x")
        if char_info.over_limit:
            thread = split_into_thread(rewritten)
            notes.append(f"Content split into {len(thread)}-tweet thread")

    elif target_platform == "linkedin":
        # Bold the first line for LinkedIn
        lines = rewritten.split("\n", 1)
        if lines:
            lines[0] = bold_unicode(lines[0])
            rewritten = "\n".join(lines)

    # Step 3: Char count
    char_info = count_characters(rewritten, target_platform)

    # Step 4: Hashtags
    hashtags = await generate_hashtags(
        brief=content[:500],
        platform=target_platform,
        niche=niche,
        count=hashtag_count,
    )

    return FormattedContent(
        platform=target_platform,
        text=rewritten,
        hashtags=hashtags,
        char_count=char_info.character_count,
        over_limit=char_info.over_limit,
        thread=thread,
        notes=notes or None,
    )


# ---------------------------------------------------------------------------
# Image pipeline
# ---------------------------------------------------------------------------

async def prepare_images(
    image_bytes: bytes,
    target_platform: str,
    grid_type: GridType | None = None,
) -> ImagePackage:
    """
    Resize an image for a platform and optionally create grid tiles.

    Args:
        image_bytes:    Source image bytes.
        target_platform: Platform to prepare for.
        grid_type:      If provided, also split into Instagram grid tiles.

    Returns:
        ImagePackage with resized formats and optional grid tiles.
    """
    format_map: dict[str, list[str]] = {
        "instagram": ["1080x1080", "1080x1920", "1080x1350"],
        "tiktok":    ["1080x1920"],
        "youtube":   ["1280x720"],
        "x":         ["1500x500", "1280x720"],
        "linkedin":  ["1280x720", "1080x1080"],
    }
    formats = format_map.get(target_platform, ["1080x1080"])
    resized = resize_to_formats(image_bytes, formats)

    grid_tiles = None
    if grid_type and target_platform == "instagram":
        grid_tiles = create_instagram_grid(image_bytes, grid_type)
        logger.info("Created {} grid tiles ({})", len(grid_tiles), grid_type)

    return ImagePackage(
        original_format=target_platform,
        resized=resized,
        grid_tiles=grid_tiles,
    )
