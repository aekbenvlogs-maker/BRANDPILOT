# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_content_formatter/image_resizer.py
# DESCRIPTION  : Resize images to standard social media formats
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import io
from typing import Literal

from PIL import Image

# Standard format presets (width x height)
FormatKey = Literal[
    "1080x1080",   # Instagram square
    "1080x1920",   # Stories / Reels (9:16)
    "1280x720",    # YouTube thumbnail / landscape
    "1500x500",    # X header
    "1080x1350",   # Instagram portrait (4:5)
]

_FORMAT_DIMS: dict[str, tuple[int, int]] = {
    "1080x1080": (1080, 1080),
    "1080x1920": (1080, 1920),
    "1280x720":  (1280, 720),
    "1500x500":  (1500, 500),
    "1080x1350": (1080, 1350),
}


def _cover_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale-and-center-crop to exact target dimensions."""
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w = int(src_w * scale)
    new_h = int(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def resize_to_formats(
    image_bytes: bytes,
    formats: list[str],
    quality: int = 92,
) -> dict[str, bytes]:
    """
    Resize an image to one or more standard formats using cover-crop.

    Args:
        image_bytes: Source image bytes (any Pillow-supported format).
        formats:     List of format keys, e.g. ["1080x1080", "1080x1920"].
        quality:     JPEG output quality (1–95).

    Returns:
        Dict mapping each format key to resized image bytes.

    Raises:
        ValueError: If an unsupported format key is requested.
    """
    source = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    result: dict[str, bytes] = {}

    for fmt in formats:
        dims = _FORMAT_DIMS.get(fmt)
        if dims is None:
            raise ValueError(
                f"Unsupported format '{fmt}'. "
                f"Valid options: {list(_FORMAT_DIMS.keys())}"
            )
        w, h = dims
        cropped = _cover_crop(source.copy(), w, h)
        buf = io.BytesIO()
        cropped.save(buf, format="JPEG", quality=quality, optimize=True)
        result[fmt] = buf.getvalue()

    return result
