# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : configs/settings.py
# DESCRIPTION  : Pydantic v2 settings — all env vars with validation
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import AliasChoices, AnyHttpUrl, EmailStr, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    BRANDSCALE application settings loaded from environment variables.

    All sensitive values (API keys, secrets) must be provided via .env
    and are never stored in source control.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    # ---------------------------------------------------------------------------
    # Application
    # ---------------------------------------------------------------------------
    app_name: str = Field(default="BRANDSCALE", description="Application name")
    app_env: Literal["development", "staging", "production"] = Field(
        default="development"
    )
    app_debug: bool = Field(default=False)
    app_version: str = Field(default="1.0.0")
    app_host: str = Field(default="0.0.0.0")
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_timezone: str = Field(default="Europe/Paris")

    # ---------------------------------------------------------------------------
    # Security — JWT
    # ---------------------------------------------------------------------------
    secret_key: str = Field(
        min_length=32,
        description="JWT signing secret — min 32 chars",
    )
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30, ge=1)
    refresh_token_expire_days: int = Field(default=7, ge=1)

    # ---------------------------------------------------------------------------
    # Database
    # ---------------------------------------------------------------------------
    database_url: str = Field(
        description="Async database URL (asyncpg or aiosqlite)"
    )
    database_url_dev: str = Field(
        default="sqlite+aiosqlite:///./brandscale_dev.db"
    )

    # ---------------------------------------------------------------------------
    # Redis / Celery
    # ---------------------------------------------------------------------------
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_cache_ttl: int = Field(default=86400, ge=60)
    celery_broker_url: str = Field(default="redis://localhost:6379/1")
    celery_result_backend: str = Field(default="redis://localhost:6379/2")

    # ---------------------------------------------------------------------------
    # AI
    # ---------------------------------------------------------------------------
    openai_api_key: str = Field(description="OpenAI API key")
    openai_base_url: str = Field(default="https://api.openai.com/v1")
    openai_model: str = Field(default="gpt-4-turbo-preview")
    openai_max_tokens: int = Field(default=2048, ge=1)
    openai_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    ollama_base_url: str = Field(default="http://localhost:11434")
    ollama_model: str = Field(default="mistral")
    ai_fallback_to_local: bool = Field(default=False)

    # ---------------------------------------------------------------------------
    # Email
    # ---------------------------------------------------------------------------
    smtp_host: str = Field(default="smtp.mailtrap.io")
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_user: str = Field(default="")
    smtp_password: str = Field(default="")
    smtp_use_tls: bool = Field(default=False, description="Use TLS for SMTP connection")
    smtp_from_email: str = Field(default="noreply@brandscale.io")
    smtp_from_name: str = Field(default="BRANDSCALE")
    sendgrid_api_key: str = Field(default="")
    mailgun_api_key: str = Field(default="")
    mailgun_domain: str = Field(default="")
    email_provider: Literal["smtp", "sendgrid", "mailgun"] = Field(default="smtp")

    # ---------------------------------------------------------------------------
    # Storage — S3
    # ---------------------------------------------------------------------------
    s3_bucket_name: str = Field(default="brandscale-assets")
    s3_region: str = Field(default="eu-west-3")
    aws_access_key_id: str = Field(default="")
    aws_secret_access_key: str = Field(default="")
    s3_endpoint_url: str = Field(default="")

    # ---------------------------------------------------------------------------
    # Encryption — RGPD
    # ---------------------------------------------------------------------------
    fernet_key: str = Field(description="Fernet key for PII encryption (base64)")
    fernet_key_previous: str = Field(
        default="",
        description="Previous Fernet key for key rotation (MultiFernet decryption fallback)",
    )

    # ---------------------------------------------------------------------------
    # Application base URL (used for double opt-in confirmation links)
    # ---------------------------------------------------------------------------
    base_url: str = Field(
        default="http://localhost:8000",
        description="Public base URL of the BRANDSCALE API",
    )

    # ---------------------------------------------------------------------------
    # Monitoring
    # ---------------------------------------------------------------------------
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(default="INFO")
    log_retention_days: int = Field(default=90, ge=1)
    log_max_size_mb: int = Field(default=10, ge=1)
    slack_webhook_url: str = Field(default="")
    alert_email: str = Field(default="")

    # ---------------------------------------------------------------------------
    # Celery Flower
    # ---------------------------------------------------------------------------
    flower_port: int = Field(default=5555, ge=1, le=65535)
    flower_basic_auth: str = Field(default="admin:changeme")

    # ---------------------------------------------------------------------------
    # CORS
    # ---------------------------------------------------------------------------
    cors_origins: str = Field(default="http://localhost:3000")

    # ---------------------------------------------------------------------------
    # RGPD thresholds
    # ---------------------------------------------------------------------------
    unsubscribe_process_delay_hours: int = Field(default=24, ge=1)
    data_retention_days: int = Field(default=730, ge=1)

    # ---------------------------------------------------------------------------
    # Multi-vertical configuration
    # ---------------------------------------------------------------------------
    active_vertical: str = Field(
        default="generic",
        validation_alias=AliasChoices("VERTICAL", "active_vertical"),
        description="Active vertical — override with VERTICAL=xxx env var. "
        "Supported: generic | rh | immo | compta | formation | esn",
    )

    # ---------------------------------------------------------------------------
    # Validators
    # ---------------------------------------------------------------------------
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:
        """Ensure CORS origins string is non-empty."""
        if not v.strip():
            return "http://localhost:3000"
        return v

    @field_validator("app_env", mode="before")
    @classmethod
    def lowercase_env(cls, v: str) -> str:
        """Normalise environment name to lowercase."""
        return v.strip().lower()

    # ---------------------------------------------------------------------------
    # Computed properties
    # ---------------------------------------------------------------------------
    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a parsed list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        """True when running in production environment."""
        return self.app_env == "production"

    @property
    def active_database_url(self) -> str:
        """Return production or development database URL based on env."""
        if self.app_env == "development":
            return self.database_url_dev
        return self.database_url

    # ---------------------------------------------------------------------------
    # Multi-vertical computed properties
    # ---------------------------------------------------------------------------
    @property
    def vertical_config(self) -> dict:
        """Load and return the active vertical's YAML configuration."""
        return _load_vertical_config(self.active_vertical)

    @property
    def scoring_weights(self) -> dict[str, float]:
        """Return scoring weights for the active vertical (must sum to 1.0)."""
        return self.vertical_config["scoring"]["weights"]

    @property
    def scoring_thresholds(self) -> dict[str, int]:
        """Return scoring thresholds (hot/warm/cold) for the active vertical."""
        return self.vertical_config["scoring"]["thresholds"]


@lru_cache(maxsize=6)
def _load_vertical_config(vertical: str) -> dict:
    """
    Load and cache a vertical YAML configuration file.

    Cached per vertical name (max 6 entries — one per supported vertical).
    Raises FileNotFoundError if the vertical YAML does not exist.
    """
    path = Path(__file__).parent.parent / "verticals" / vertical / "vertical.yaml"
    if not path.exists():
        supported = "generic | rh | immo | compta | formation | esn"
        raise FileNotFoundError(
            f"Vertical config not found: {path}\n"
            f"Supported verticals: {supported}\n"
            f"Run 'make list-verticals' to see available verticals."
        )
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return cached application settings instance.

    Cached with lru_cache to avoid re-reading .env on every call.
    Usage:
        from configs.settings import get_settings
        settings = get_settings()
    """
    return Settings()  # type: ignore[call-arg]


if __name__ == "__main__":
    import json

    settings = get_settings()
    safe_dump = {
        "app_name": settings.app_name,
        "app_env": settings.app_env,
        "app_version": settings.app_version,
        "openai_model": settings.openai_model,
        "email_provider": settings.email_provider,
        "is_production": settings.is_production,
    }
    print("[BRANDSCALE] Settings loaded:")
    print(json.dumps(safe_dump, indent=2))
