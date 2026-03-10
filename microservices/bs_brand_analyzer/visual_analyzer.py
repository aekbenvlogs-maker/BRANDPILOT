# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_brand_analyzer/visual_analyzer.py
# DESCRIPTION  : Brand visual analysis — color palette + GPT-4 Vision style
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import base64
import io
import json
from dataclasses import dataclass, field

import httpx
from colorthief import ColorThief
from loguru import logger
from PIL import Image

from configs.ai_config import get_openai_client


@dataclass
class VisualAnalysis:
    primary_colors: list[str]    # hex strings, most dominant
    secondary_colors: list[str]  # hex strings
    style: str                   # e.g. "minimalist", "vibrant", "corporate"
    mood: str                    # e.g. "trustworthy", "playful", "luxurious"


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


async def _download_image(client: httpx.AsyncClient, url: str) -> bytes | None:
    try:
        resp = await client.get(url, timeout=15, follow_redirects=True)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            return None
        return resp.content
    except Exception as exc:
        logger.debug("[visual_analyzer] Image download failed url={} exc={}", url, exc)
        return None


def _extract_palette(image_bytes: bytes) -> tuple[list[str], list[str]]:
    """Extract dominant and secondary color palettes from image bytes."""
    try:
        buf = io.BytesIO(image_bytes)
        # Convert to JPEG in-memory (colorthief works best with JPEG)
        img = Image.open(buf).convert("RGB")
        jpeg_buf = io.BytesIO()
        img.save(jpeg_buf, format="JPEG", quality=85)
        jpeg_buf.seek(0)
        ct = ColorThief(jpeg_buf)
        palette = ct.get_palette(color_count=6, quality=5)
        primary = [_rgb_to_hex(c) for c in palette[:2]]
        secondary = [_rgb_to_hex(c) for c in palette[2:]]
        return primary, secondary
    except Exception as exc:
        logger.warning("[visual_analyzer] Palette extraction failed: {}", exc)
        return [], []


async def _analyze_style_with_vision(
    images_b64: list[str],
) -> tuple[str, str]:
    """Use GPT-4 Vision to classify visual style and mood."""
    client = get_openai_client()

    content: list[dict[str, object]] = [
        {
            "type": "text",
            "text": (
                "Analyse the visual style of these brand images. "
                "Respond ONLY with JSON: "
                '{"style": "<minimalist|vibrant|corporate|playful|luxurious|editorial>", '
                '"mood": "<description>"}'
            ),
        }
    ]
    for b64 in images_b64[:3]:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"},
            }
        )

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": content}],  # type: ignore[arg-type]
            max_tokens=100,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data: dict[str, str] = json.loads(raw)
        return data.get("style", "corporate"), data.get("mood", "professional")
    except Exception as exc:
        logger.warning("[visual_analyzer] Vision API failed: {}", exc)
        return "corporate", "professional"


async def analyze_brand_visuals(image_urls: list[str]) -> VisualAnalysis:
    """
    Download up to 3 brand images, extract colour palette and analyse
    visual style with GPT-4 Vision.

    Args:
        image_urls: List of absolute image URLs from the scraped site.

    Returns:
        VisualAnalysis dataclass.
    """
    all_primary: list[str] = []
    all_secondary: list[str] = []
    images_b64: list[str] = []

    async with httpx.AsyncClient() as client:
        for url in image_urls[:3]:
            img_bytes = await _download_image(client, url)
            if img_bytes is None:
                continue
            primary, secondary = _extract_palette(img_bytes)
            all_primary.extend(primary)
            all_secondary.extend(secondary)
            images_b64.append(base64.b64encode(img_bytes).decode())

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_primary: list[str] = []
    for c in all_primary:
        if c not in seen:
            seen.add(c)
            unique_primary.append(c)

    unique_secondary: list[str] = []
    for c in all_secondary:
        if c not in seen:
            seen.add(c)
            unique_secondary.append(c)

    style, mood = ("corporate", "professional")
    if images_b64:
        style, mood = await _analyze_style_with_vision(images_b64)

    return VisualAnalysis(
        primary_colors=unique_primary[:3],
        secondary_colors=unique_secondary[:3],
        style=style,
        mood=mood,
    )
