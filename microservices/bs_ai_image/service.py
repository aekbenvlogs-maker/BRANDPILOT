# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_image/service.py
# DESCRIPTION  : AI image generation and S3 upload service
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from typing import Any

import boto3
import httpx
from loguru import logger

from configs.settings import get_settings

settings = get_settings()

# Platform image size presets
_PLATFORM_SIZES: dict[str, str] = {
    "linkedin": "1200x627",
    "instagram": "1080x1080",
    "facebook": "1200x628",
    "twitter": "1200x675",
    "ads": "1080x1080",
    "email": "600x300",
}


def _get_s3_client() -> Any:
    """Return a boto3 S3 client with configured credentials."""
    kwargs: dict[str, Any] = {
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "region_name": settings.s3_region,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


async def _upload_image_to_s3(image_bytes: bytes, filename: str) -> str:
    """
    Upload image bytes to S3 and return the public URL.

    Args:
        image_bytes: Raw image data.
        filename:    S3 object key filename.

    Returns:
        Public S3 URL string.
    """
    s3 = _get_s3_client()
    key = f"images/{filename}"
    s3.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=image_bytes,
        ContentType="image/png",
        ACL="public-read",
    )
    if settings.s3_endpoint_url:
        return f"{settings.s3_endpoint_url}/{settings.s3_bucket_name}/{key}"
    return f"https://{settings.s3_bucket_name}.s3.{settings.s3_region}.amazonaws.com/{key}"


async def generate_marketing_image(
    prompt: str,
    style: str = "photorealistic",
    size: str = "1024x1024",
) -> str:
    """
    Generate a marketing image via DALL-E and upload to S3.

    Args:
        prompt: Image generation prompt.
        style:  Visual style (photorealistic/illustration/minimalist).
        size:   Output size (1024x1024/1792x1024/1024x1792).

    Returns:
        S3 URL of the generated image.
    """
    from configs.ai_config import get_openai_client

    client = get_openai_client()
    full_prompt = f"{prompt}. Style: {style}. Marketing visual, professional quality."

    try:
        response = await client.images.generate(
            model="dall-e-3",
            prompt=full_prompt,
            n=1,
            size=size,  # type: ignore[arg-type]
            quality="standard",
            response_format="url",
        )
        image_url = response.data[0].url or ""

        # Download image and upload to S3
        async with httpx.AsyncClient(timeout=30.0) as http:
            img_response = await http.get(image_url)
            img_response.raise_for_status()

        filename = f"{uuid.uuid4()}.png"
        s3_url = await _upload_image_to_s3(img_response.content, filename)

        logger.info("[bs_ai_image] Image generated and uploaded | url={}", s3_url)
        return s3_url

    except Exception as exc:
        logger.error("[bs_ai_image] Image generation failed | error={}", str(exc))
        # Return placeholder image URL
        return f"https://via.placeholder.com/{size.replace('x', '/')}"


async def resize_for_platform(image_url: str, platform: str) -> str:
    """
    Resize an existing image for a specific platform format.

    Uses S3 URL rewriting convention for CDN-based resize.
    In production, use AWS Lambda@Edge or imgix for real resizing.

    Args:
        image_url: Source image URL.
        platform:  Target platform key.

    Returns:
        Resized image URL.
    """
    target_size = _PLATFORM_SIZES.get(platform, "1080x1080")
    logger.info(
        "[bs_ai_image] Resize requested | platform={} size={}",
        platform, target_size,
    )
    # Real implementation would invoke a resize Lambda/microservice
    # For now, return the original URL with size param for CDN processing
    separator = "&" if "?" in image_url else "?"
    return f"{image_url}{separator}size={target_size}"


if __name__ == "__main__":
    import asyncio

    async def _smoke() -> None:
        url = await generate_marketing_image(
            "professional marketing banner for a SaaS product",
            style="minimalist",
        )
        print(f"[bs_ai_image] Generated: {url}")

    asyncio.run(_smoke())
