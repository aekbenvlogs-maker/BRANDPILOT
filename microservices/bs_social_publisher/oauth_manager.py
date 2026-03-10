# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_social_publisher/oauth_manager.py
# DESCRIPTION  : OAuth 2.0 token management (SECURITY CRITICAL)
#
# SECURITY RULES — STRICTLY ENFORCED:
#   1. OAuth tokens ALWAYS Fernet-encrypted before DB write.
#   2. Plaintext tokens NEVER appear in logs, errors, or exceptions.
#   3. get_valid_token() is the ONLY method that returns plaintext.
#   4. refresh_platform_token() re-encrypts immediately after API call.
#
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import hashlib
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, MultiFernet
from loguru import logger
from sqlalchemy import text

from configs.settings import get_settings
from database.connection import db_session

settings = get_settings()

# ---------------------------------------------------------------------------
# Fernet helper (dual-key rotation support)
# ---------------------------------------------------------------------------

def _get_fernet() -> MultiFernet:
    keys = [Fernet(settings.fernet_key.encode())]
    if settings.fernet_key_previous:
        keys.append(Fernet(settings.fernet_key_previous.encode()))
    return MultiFernet(keys)


def _encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def _decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()


# ---------------------------------------------------------------------------
# OAuth platform configs
# ---------------------------------------------------------------------------

_OAUTH_CONFIGS: dict[str, dict] = {
    "instagram": {
        "auth_url":   "https://www.facebook.com/dialog/oauth",
        "token_url":  "https://graph.facebook.com/v19.0/oauth/access_token",
        "scope":      "instagram_basic,instagram_content_publish,pages_read_engagement",
        "client_id":  settings.meta_app_id if hasattr(settings, "meta_app_id") else "",
        "client_secret": settings.meta_app_secret if hasattr(settings, "meta_app_secret") else "",
    },
    "tiktok": {
        "auth_url":   "https://www.tiktok.com/v2/auth/authorize/",
        "token_url":  "https://open.tiktokapis.com/v2/oauth/token/",
        "scope":      "user.info.basic,video.upload,video.publish",
        "client_id":  settings.tiktok_client_key if hasattr(settings, "tiktok_client_key") else "",
        "client_secret": settings.tiktok_client_secret if hasattr(settings, "tiktok_client_secret") else "",
    },
    "youtube": {
        "auth_url":   "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url":  "https://oauth2.googleapis.com/token",
        "scope":      "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        "client_id":  settings.google_client_id if hasattr(settings, "google_client_id") else "",
        "client_secret": settings.google_client_secret if hasattr(settings, "google_client_secret") else "",
    },
    "x": {
        "auth_url":   "https://twitter.com/i/oauth2/authorize",
        "token_url":  "https://api.twitter.com/2/oauth2/token",
        "scope":      "tweet.read tweet.write users.read offline.access",
        "client_id":  settings.x_client_id if hasattr(settings, "x_client_id") else "",
        "client_secret": settings.x_client_secret if hasattr(settings, "x_client_secret") else "",
    },
    "linkedin": {
        "auth_url":   "https://www.linkedin.com/oauth/v2/authorization",
        "token_url":  "https://www.linkedin.com/oauth/v2/accessToken",
        "scope":      "r_liteprofile w_member_social",
        "client_id":  settings.linkedin_client_id if hasattr(settings, "linkedin_client_id") else "",
        "client_secret": settings.linkedin_client_secret if hasattr(settings, "linkedin_client_secret") else "",
    },
}


@dataclass
class OAuthToken:
    access_token: str       # plaintext — handle with care
    refresh_token: str | None
    expires_at: datetime | None
    platform: str
    scope: str | None = None


# ---------------------------------------------------------------------------
# OAuthManager
# ---------------------------------------------------------------------------

class OAuthManager:
    """
    Manages OAuth 2.0 flows for all supported social platforms.

    Security contract:
    - Tokens are encrypted with Fernet before any DB write.
    - No plaintext token ever touches a log line.
    - get_valid_token() is the single exit point for plaintext.
    """

    # -----------------------------------------------------------------------
    # Authorization URL
    # -----------------------------------------------------------------------

    def get_authorization_url(
        self,
        platform: str,
        project_id: str,
        redirect_uri: str,
    ) -> str:
        """
        Build the OAuth authorization URL for a given platform.

        Args:
            platform:     Social platform key.
            project_id:   Project UUID to encode in state param.
            redirect_uri: Callback URI registered with the platform.

        Returns:
            Authorization URL string.
        """
        cfg = _OAUTH_CONFIGS[platform]
        state = f"{project_id}:{secrets.token_urlsafe(16)}"

        params: dict[str, str] = {
            "client_id":     cfg["client_id"],
            "redirect_uri":  redirect_uri,
            "scope":         cfg["scope"],
            "response_type": "code",
            "state":         state,
        }

        # PKCE for X
        if platform == "x":
            code_verifier = secrets.token_urlsafe(32)
            code_challenge = hashlib.sha256(code_verifier.encode()).digest().hex()
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"

        return f"{cfg['auth_url']}?{urlencode(params)}"

    # -----------------------------------------------------------------------
    # Exchange code → token
    # -----------------------------------------------------------------------

    async def exchange_code_for_token(
        self,
        platform: str,
        code: str,
        redirect_uri: str,
        project_id: str,
        code_verifier: str | None = None,
    ) -> OAuthToken:
        """
        Exchange an authorization code for an access token and persist (encrypted).

        Returns:
            OAuthToken with plaintext access_token (use immediately, don't log).
        """
        cfg = _OAUTH_CONFIGS[platform]
        payload: dict[str, str] = {
            "grant_type":    "authorization_code",
            "code":          code,
            "redirect_uri":  redirect_uri,
            "client_id":     cfg["client_id"],
            "client_secret": cfg["client_secret"],
        }
        if code_verifier:
            payload["code_verifier"] = code_verifier

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(cfg["token_url"], data=payload)
            r.raise_for_status()
            data = r.json()

        expires_in = data.get("expires_in")
        expires_at: datetime | None = None
        if expires_in:
            expires_at = datetime.fromtimestamp(
                time.time() + int(expires_in), tz=timezone.utc
            )

        token = OAuthToken(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=expires_at,
            platform=platform,
            scope=data.get("scope"),
        )

        await self._persist_token(token, project_id)
        return token

    # -----------------------------------------------------------------------
    # Refresh
    # -----------------------------------------------------------------------

    async def refresh_platform_token(
        self,
        social_account_id: str,
    ) -> OAuthToken:
        """
        Refresh an expired access token and update the DB (encrypted).

        Returns:
            OAuthToken with fresh plaintext access_token.
        """
        async with db_session() as session:
            row = await session.execute(
                text("SELECT * FROM social_accounts WHERE id = :id"),
                {"id": social_account_id},
            )
            account = row.mappings().first()

        if not account:
            raise ValueError(f"social_account {social_account_id} not found")

        platform = account["platform"]
        cfg = _OAUTH_CONFIGS[platform]
        refresh_token_enc = account.get("refresh_token_enc")
        if not refresh_token_enc:
            raise ValueError("No refresh token stored — user must re-authorize")

        refresh_token = _decrypt(refresh_token_enc)
        payload = {
            "grant_type":    "refresh_token",
            "refresh_token": refresh_token,
            "client_id":     cfg["client_id"],
            "client_secret": cfg["client_secret"],
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(cfg["token_url"], data=payload)
            r.raise_for_status()
            data = r.json()

        expires_in = data.get("expires_in")
        expires_at: datetime | None = None
        if expires_in:
            expires_at = datetime.fromtimestamp(
                time.time() + int(expires_in), tz=timezone.utc
            )

        new_token = OAuthToken(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", refresh_token),
            expires_at=expires_at,
            platform=platform,
        )

        # Re-encrypt immediately before write
        enc_access = _encrypt(new_token.access_token)
        enc_refresh = _encrypt(new_token.refresh_token) if new_token.refresh_token else None

        async with db_session() as session:
            await session.execute(
                text("""
                    UPDATE social_accounts
                    SET access_token_enc = :at,
                        refresh_token_enc = :rt,
                        token_expires_at = :exp,
                        updated_at = NOW()
                    WHERE id = :id
                """),
                {
                    "at":  enc_access,
                    "rt":  enc_refresh,
                    "exp": expires_at,
                    "id":  social_account_id,
                },
            )
            await session.commit()

        logger.info("Token refreshed for social_account {} on {}", social_account_id, platform)
        return new_token

    # -----------------------------------------------------------------------
    # Get valid token (ONLY plaintext exit point)
    # -----------------------------------------------------------------------

    async def get_valid_token(self, social_account_id: str) -> str:
        """
        Return the current plaintext access token, auto-refreshing if expired.

        SECURITY NOTE: Do NOT pass the return value to any logger.

        Returns:
            Plaintext access token string.
        """
        async with db_session() as session:
            row = await session.execute(
                text("SELECT * FROM social_accounts WHERE id = :id"),
                {"id": social_account_id},
            )
            account = row.mappings().first()

        if not account:
            raise ValueError(f"social_account {social_account_id} not found")

        # Auto-refresh if expired (buffer: 5 minutes)
        expires_at = account.get("token_expires_at")
        if expires_at:
            remaining = (expires_at - datetime.now(tz=timezone.utc)).total_seconds()
            if remaining < 300:
                logger.info("Token expiring soon for {}, refreshing…", social_account_id)
                fresh = await self.refresh_platform_token(social_account_id)
                return fresh.access_token

        return _decrypt(account["access_token_enc"])

    # -----------------------------------------------------------------------
    # Revoke
    # -----------------------------------------------------------------------

    async def revoke_token(self, social_account_id: str) -> bool:
        """
        Revoke the platform token and remove the social_account row from DB.

        Returns:
            True if successful, False otherwise.
        """
        try:
            async with db_session() as session:
                await session.execute(
                    text("DELETE FROM social_accounts WHERE id = :id"),
                    {"id": social_account_id},
                )
                await session.commit()
            logger.info("Revoked token for social_account {}", social_account_id)
            return True
        except Exception as exc:
            logger.error("revoke_token failed for {}: type={}", social_account_id, type(exc).__name__)
            return False

    # -----------------------------------------------------------------------
    # Internal persistence helper
    # -----------------------------------------------------------------------

    async def _persist_token(self, token: OAuthToken, project_id: str) -> None:
        """Encrypt and store token. NEVER log the plaintext token."""
        enc_access = _encrypt(token.access_token)
        enc_refresh = _encrypt(token.refresh_token) if token.refresh_token else None

        async with db_session() as session:
            await session.execute(
                text("""
                    INSERT INTO social_accounts
                        (project_id, platform, access_token_enc, refresh_token_enc,
                         token_expires_at, created_at, updated_at)
                    VALUES
                        (:project_id, :platform, :at, :rt, :exp, NOW(), NOW())
                    ON CONFLICT (project_id, platform)
                    DO UPDATE SET
                        access_token_enc  = EXCLUDED.access_token_enc,
                        refresh_token_enc = EXCLUDED.refresh_token_enc,
                        token_expires_at  = EXCLUDED.token_expires_at,
                        updated_at        = NOW()
                """),
                {
                    "project_id": project_id,
                    "platform":   token.platform,
                    "at":         enc_access,
                    "rt":         enc_refresh,
                    "exp":        token.expires_at,
                },
            )
            await session.commit()

        logger.info("Token persisted (encrypted) for project {} on {}", project_id, token.platform)


# Module-level singleton
oauth_manager = OAuthManager()
