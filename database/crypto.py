# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : database/crypto.py
# DESCRIPTION  : Shared Fernet PII encryption/decryption utilities.
#                Extracted here so both backend services AND microservices
#                can import without circular dependencies.
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-09
# ============================================================

from __future__ import annotations

from cryptography.fernet import Fernet, MultiFernet
from loguru import logger

from configs.settings import get_settings

settings = get_settings()


# ---------------------------------------------------------------------------
# Fernet encryption for PII fields
# ---------------------------------------------------------------------------


def _get_fernet() -> MultiFernet:
    """
    Build a MultiFernet instance supporting key rotation.

    The primary key is FERNET_KEY. If FERNET_KEY_PREVIOUS is set (non-empty),
    it is added as a decryption fallback so that data encrypted with the old
    key can still be read during rotation without any downtime.
    """
    keys = [Fernet(settings.fernet_key.encode())]
    if settings.fernet_key_previous:
        keys.append(Fernet(settings.fernet_key_previous.encode()))
    return MultiFernet(keys)


_fernet = _get_fernet()


def encrypt_pii(value: str | None) -> str | None:
    """Encrypt a PII string with Fernet symmetric encryption."""
    if value is None:
        return None
    return _fernet.encrypt(value.encode()).decode()


def decrypt_pii(value: str | None) -> str | None:
    """Decrypt a Fernet-encrypted PII string. Returns None on decryption failure."""
    if value is None:
        return None
    try:
        return _fernet.decrypt(value.encode()).decode()
    except Exception:
        logger.error("[BRANDSCALE] PII decryption failed — data may be corrupt.")
        return None
