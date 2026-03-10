# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/grid_maker.py
# DESCRIPTION  : Instagram grid / carousel tile generator
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import io
from typing import Literal

from PIL import Image

GridType = Literal["3x3", "3x1", "carousel_3", "carousel_5"]

_GRID_CONFIGS: dict[str, dict] = {
    "3x3":       {"cols": 3, "rows": 3, "tile_size": (1080, 1080)},
    "3x1":       {"cols": 3, "rows": 1, "tile_size": (1080, 1080)},
    "carousel_3": {"cols": 3, "rows": 1, "tile_size": (1080, 1080)},
    "carousel_5": {"cols": 5, "rows": 1, "tile_size": (1080, 1080)},
}


def _img_to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def create_instagram_grid(
    image_bytes: bytes,
    grid_type: GridType = "3x3",
) -> list[bytes]:
    """
    Split an image into grid tiles for Instagram posting.

    Args:
        image_bytes: Source image bytes (JPEG/PNG).
        grid_type:   Grid layout: '3x3' (9 tiles), '3x1' (3 tiles),
                     'carousel_3' (3 slides), 'carousel_5' (5 slides).

    Returns:
        List of tile images as bytes, left-to-right, top-to-bottom order.
    """
    cfg = _GRID_CONFIGS[grid_type]
    cols: int = cfg["cols"]
    rows: int = cfg["rows"]
    tile_w, tile_h = cfg["tile_size"]

    total_w = tile_w * cols
    total_h = tile_h * rows

    source = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    # Scale to cover the full grid canvas
    source = _cover_crop(source, total_w, total_h)

    tiles: list[bytes] = []
    for row in range(rows):
        for col in range(cols):
            left = col * tile_w
            upper = row * tile_h
            tile = source.crop((left, upper, left + tile_w, upper + tile_h))
            tiles.append(_img_to_bytes(tile))

    return tiles


def _cover_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale and center-crop an image to exactly (target_w, target_h)."""
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w = int(src_w * scale)
    new_h = int(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))
