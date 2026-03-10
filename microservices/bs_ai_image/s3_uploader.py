# -*- coding: utf-8 -*-
# BRANDPILOT — microservices/bs_ai_image/s3_uploader.py
# Async S3 upload and deletion helpers for generated images.
# Copyright © 2026 BRANDPILOT Dev Team — MIT License

from __future__ import annotations

import os
import uuid
from pathlib import Path

from loguru import logger

from configs.settings import get_settings

settings = get_settings()

# Local fallback directory when S3 is unavailable
_LOCAL_FALLBACK_DIR = Path("/tmp/brandpilot/images")

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_s3_key(project_id: str, filename: str) -> str:
    """Build the S3 object key for a project image.

    Args:
        project_id: UUID string of the owning project.
        filename:   Original filename (without path).

    Returns:
        S3 object key string.
    """
    unique_prefix = str(uuid.uuid4()).replace("-", "")[:8]
    return f"projects/{project_id}/images/{unique_prefix}_{filename}"


def _public_url(key: str) -> str:
    """Build the public HTTPS URL for an S3 key.

    Args:
        key: S3 object key.

    Returns:
        Full public URL string.
    """
    if settings.s3_endpoint_url:
        return f"{settings.s3_endpoint_url.rstrip('/')}/{settings.s3_bucket_name}/{key}"
    return (
        f"https://{settings.s3_bucket_name}"
        f".s3.{settings.s3_region}.amazonaws.com/{key}"
    )


def _key_from_url(s3_url: str) -> str | None:
    """Extract the S3 object key from a public URL.

    Handles both path-style (MinIO) and virtual-hosted-style (AWS) URLs.

    Args:
        s3_url: Public URL of the S3 object.

    Returns:
        Object key string, or None if parsing fails.
    """
    try:
        if settings.s3_endpoint_url:
            # Path-style: http://host/bucket/key
            prefix = f"{settings.s3_endpoint_url.rstrip('/')}/{settings.s3_bucket_name}/"
            if s3_url.startswith(prefix):
                return s3_url[len(prefix):]
        else:
            # Virtual-hosted: https://bucket.s3.region.amazonaws.com/key
            host_prefix = (
                f"https://{settings.s3_bucket_name}"
                f".s3.{settings.s3_region}.amazonaws.com/"
            )
            if s3_url.startswith(host_prefix):
                return s3_url[len(host_prefix):]
        return None
    except Exception as exc:
        logger.warning("[s3_uploader] URL parse failed | url={} error={}", s3_url, exc)
        return None


def _save_local_fallback(image_bytes: bytes, filename: str) -> str:
    """Save image bytes to the local fallback directory.

    Args:
        image_bytes: Raw image data.
        filename:    Target filename.

    Returns:
        Absolute local file path as a string (prefixed with "file://").
    """
    _LOCAL_FALLBACK_DIR.mkdir(parents=True, exist_ok=True)
    path = _LOCAL_FALLBACK_DIR / filename
    path.write_bytes(image_bytes)
    logger.warning(
        "[s3_uploader] S3 unavailable — saved locally | path={}", str(path)
    )
    return f"file://{path}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def upload_image(
    image_bytes: bytes,
    filename: str,
    project_id: str,
    content_type: str = "image/png",
) -> str:
    """Upload image bytes to S3 and return the public URL.

    Falls back to a local /tmp path if S3 is unreachable.

    Note:
        S3 lifecycle policy should be configured to delete objects older than
        90 days (``--lifecycle-configuration Expiration.Days=90``).

    Args:
        image_bytes:  Raw image data to upload.
        filename:     Base filename (e.g. "dalle_output.png").
        project_id:   UUID string of the owning project (used in the key path).
        content_type: MIME type for the S3 object (default: "image/png").

    Returns:
        Public HTTPS URL of the uploaded image, or a ``file://`` URL on fallback.

    Raises:
        RuntimeError: If both S3 and local fallback fail.
    """
    key = _build_s3_key(project_id, filename)

    try:
        import boto3  # imported lazily to avoid import cost when S3 is unused

        extra_kwargs: dict[str, str] = {}
        client_kwargs: dict[str, str] = {
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key,
            "region_name": settings.s3_region,
        }
        if settings.s3_endpoint_url:
            client_kwargs["endpoint_url"] = settings.s3_endpoint_url

        # For public-read ACL (only for AWS S3, not MinIO by default)
        if not settings.s3_endpoint_url:
            extra_kwargs["ACL"] = "public-read"

        s3 = boto3.client("s3", **client_kwargs)  # type: ignore[call-overload]
        s3.put_object(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
            **extra_kwargs,
        )
        url = _public_url(key)
        logger.info(
            "[s3_uploader] Uploaded | project={} key={} size={}B",
            project_id,
            key,
            len(image_bytes),
        )
        return url

    except Exception as exc:
        logger.error(
            "[s3_uploader] Upload failed | project={} error={} — using local fallback",
            project_id,
            exc,
        )
        return _save_local_fallback(image_bytes, filename)


async def delete_image(s3_url: str) -> bool:
    """Delete an image from S3 by its public URL.

    Silently returns False (with a log warning) if the key cannot be resolved
    or the deletion fails — callers should not crash on cleanup failures.

    Args:
        s3_url: Public URL of the image to delete.

    Returns:
        True if deleted successfully, False otherwise.
    """
    key = _key_from_url(s3_url)
    if not key:
        logger.warning(
            "[s3_uploader] Cannot resolve S3 key from URL | url={}", s3_url
        )
        return False

    try:
        import boto3

        client_kwargs: dict[str, str] = {
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key,
            "region_name": settings.s3_region,
        }
        if settings.s3_endpoint_url:
            client_kwargs["endpoint_url"] = settings.s3_endpoint_url

        s3 = boto3.client("s3", **client_kwargs)  # type: ignore[call-overload]
        s3.delete_object(Bucket=settings.s3_bucket_name, Key=key)
        logger.info("[s3_uploader] Deleted | key={}", key)
        return True

    except Exception as exc:
        logger.error("[s3_uploader] Delete failed | key={} error={}", key, exc)
        return False


async def generate_presigned_url(s3_url: str, expires_in: int = 3600) -> str | None:
    """Generate a pre-signed URL for private S3 objects.

    Args:
        s3_url:     Public URL of the S3 object.
        expires_in: Expiry in seconds (default 1 hour).

    Returns:
        Pre-signed URL string, or None on failure.
    """
    key = _key_from_url(s3_url)
    if not key:
        return None

    try:
        import boto3

        client_kwargs: dict[str, str] = {
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key,
            "region_name": settings.s3_region,
        }
        if settings.s3_endpoint_url:
            client_kwargs["endpoint_url"] = settings.s3_endpoint_url

        s3 = boto3.client("s3", **client_kwargs)  # type: ignore[call-overload]
        url: str = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )
        return url

    except Exception as exc:
        logger.error(
            "[s3_uploader] Presign failed | key={} error={}", key, exc
        )
        return None
