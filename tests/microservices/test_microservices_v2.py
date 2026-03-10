# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : tests/microservices/test_microservices_v2.py
# DESCRIPTION  : Test suite for V2 microservices
#                (oauth, publishers, engagement, pricing, formatter)
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import base64
import io
import logging
from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch, call

import httpx
import pytest
from cryptography.fernet import Fernet
from PIL import Image

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_test_fernet_key() -> str:
    return Fernet.generate_key().decode()


def _make_test_image_bytes(w: int = 1080, h: int = 1080) -> bytes:
    img = Image.new("RGB", (w, h), color=(128, 64, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# TestOAuthManager
# ---------------------------------------------------------------------------

class TestOAuthManager:
    """Tests for OAuthManager security guarantees."""

    @pytest.mark.security
    async def test_token_stored_encrypted(self, monkeypatch):
        """Access token must be Fernet-encrypted before DB write — never plaintext."""
        from microservices.bs_social_publisher.oauth_manager import OAuthManager, _encrypt, _decrypt

        manager = OAuthManager()
        stored_values: list[dict] = []

        async def fake_db_execute(query, params):
            stored_values.append(dict(params))
            mock = MagicMock()
            mock.mappings.return_value.first.return_value = None
            return mock

        fake_session = AsyncMock()
        fake_session.__aenter__ = AsyncMock(return_value=fake_session)
        fake_session.__aexit__ = AsyncMock(return_value=False)
        fake_session.execute = fake_db_execute
        fake_session.commit = AsyncMock()

        plaintext_token = "SUPER_SECRET_TOKEN_12345"

        with patch("microservices.bs_social_publisher.oauth_manager.db_session", return_value=fake_session):
            from microservices.bs_social_publisher.oauth_manager import OAuthToken
            from datetime import datetime, timezone
            token_obj = OAuthToken(
                access_token=plaintext_token,
                refresh_token=None,
                expires_at=None,
                platform="instagram",
            )
            await manager._persist_token(token_obj, project_id="proj-123")

        assert stored_values, "No DB write occurred"
        stored_at = stored_values[0].get("at", "")
        # Must NOT be plaintext
        assert stored_at != plaintext_token, "Token stored in plaintext!"
        # Must be decryptable
        decrypted = _decrypt(stored_at)
        assert decrypted == plaintext_token

    @pytest.mark.security
    async def test_token_not_in_logs(self, caplog, monkeypatch):
        """Plaintext access token must NEVER appear in any log line."""
        from microservices.bs_social_publisher.oauth_manager import OAuthManager

        manager = OAuthManager()
        plaintext_token = "TOP_SECRET_OAUTH_TOKEN_SHOULD_NOT_LEAK"

        # Mock DB to return an account with encrypted token
        from cryptography.fernet import Fernet
        key = Fernet.generate_key()
        enc = Fernet(key).encrypt(plaintext_token.encode()).decode()

        account_data = {
            "id": "acc-1",
            "platform": "instagram",
            "access_token_enc": enc,
            "refresh_token_enc": None,
            "token_expires_at": None,
        }

        fake_row = MagicMock()
        fake_row.mappings.return_value.first.return_value = account_data
        fake_session = AsyncMock()
        fake_session.__aenter__ = AsyncMock(return_value=fake_session)
        fake_session.__aexit__ = AsyncMock(return_value=False)
        fake_session.execute = AsyncMock(return_value=fake_row)

        with patch("microservices.bs_social_publisher.oauth_manager.db_session", return_value=fake_session):
            with patch("microservices.bs_social_publisher.oauth_manager._get_fernet") as mock_fernet:
                mock_f = MagicMock()
                mock_f.decrypt.return_value = plaintext_token.encode()
                mock_fernet.return_value = mock_f

                with caplog.at_level(logging.DEBUG):
                    # get_valid_token logs must not contain the plaintext token
                    try:
                        await manager.get_valid_token("acc-1")
                    except Exception:
                        pass

        for record in caplog.records:
            assert plaintext_token not in record.getMessage(), \
                f"Plaintext token leaked in log: {record.getMessage()}"

    async def test_expired_token_auto_refreshed(self, monkeypatch):
        """get_valid_token must auto-refresh when token expires in < 5 minutes."""
        from microservices.bs_social_publisher.oauth_manager import OAuthManager
        from datetime import datetime, timezone, timedelta

        manager = OAuthManager()
        # Token expires in 60s (well within the 5-minute buffer)
        expires_soon = datetime.now(tz=timezone.utc) + timedelta(seconds=60)

        account_data = {
            "id": "acc-2",
            "platform": "instagram",
            "access_token_enc": "enc_old",
            "refresh_token_enc": "enc_refresh",
            "token_expires_at": expires_soon,
        }

        fake_row = MagicMock()
        fake_row.mappings.return_value.first.return_value = account_data
        fake_session = AsyncMock()
        fake_session.__aenter__ = AsyncMock(return_value=fake_session)
        fake_session.__aexit__ = AsyncMock(return_value=False)
        fake_session.execute = AsyncMock(return_value=fake_row)

        refreshed_token = "FRESH_TOKEN_AFTER_REFRESH"
        mock_refresh = AsyncMock()
        from microservices.bs_social_publisher.oauth_manager import OAuthToken
        mock_refresh.return_value = OAuthToken(
            access_token=refreshed_token,
            refresh_token=None,
            expires_at=None,
            platform="instagram",
        )

        with patch("microservices.bs_social_publisher.oauth_manager.db_session", return_value=fake_session):
            with patch.object(manager, "refresh_platform_token", mock_refresh):
                token = await manager.get_valid_token("acc-2")

        mock_refresh.assert_called_once_with("acc-2")
        assert token == refreshed_token


# ---------------------------------------------------------------------------
# TestPublishers
# ---------------------------------------------------------------------------

class TestPublishers:
    """Security and correctness tests for social publishers."""

    @pytest.mark.security
    async def test_publish_blocked_if_not_approved(self):
        """Publishing a non-approved post must raise BlockedPublicationError."""
        from microservices.bs_social_publisher.instagram_publisher import (
            publish_instagram_post,
            BlockedPublicationError,
        )
        post = {
            "id": "post-1",
            "status": "draft",  # NOT approved
            "caption": "hello",
            "image_url": "https://example.com/img.jpg",
            "campaign": {"id": "camp-1", "status": "active"},
        }
        with pytest.raises(BlockedPublicationError):
            await publish_instagram_post(post, "acc-1", "ig-user-1")

    @pytest.mark.security
    async def test_publish_blocked_if_campaign_not_approved(self):
        """Publishing when campaign is 'pending' must raise BlockedPublicationError."""
        from microservices.bs_social_publisher.instagram_publisher import (
            publish_instagram_post,
            BlockedPublicationError,
        )
        post = {
            "id": "post-2",
            "status": "approved",
            "caption": "hello",
            "image_url": "https://example.com/img.jpg",
            "campaign": {"id": "camp-2", "status": "pending"},  # NOT approved
        }
        with pytest.raises(BlockedPublicationError):
            await publish_instagram_post(post, "acc-1", "ig-user-1")

    async def test_publish_success_updates_status(self):
        """A successful publish should mark the post as 'published' in DB."""
        from microservices.bs_social_publisher import service

        mock_result = MagicMock()
        mock_result.success = True
        mock_result.platform_post_id = "ig-post-999"
        mock_result.error = None
        mock_result.platform = "instagram"

        # Patch all DB + publisher calls
        with patch.object(service, "publish_instagram_post", AsyncMock(return_value=mock_result)):
            with patch.object(service, "_mark_published", AsyncMock()) as mock_mark:
                with patch("microservices.bs_social_publisher.service.db_session") as mock_db_ctx:
                    mock_session = AsyncMock()
                    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
                    mock_session.__aexit__ = AsyncMock(return_value=False)

                    post_row = MagicMock()
                    post_row.mappings.return_value.first.return_value = {
                        "id": "post-3", "status": "approved",
                        "campaign_id": "camp-3", "campaign_status": "active",
                        "caption": "test", "ig_user_id": "ig-1",
                    }
                    account_row = MagicMock()
                    account_row.mappings.return_value.first.return_value = {
                        "platform": "instagram",
                    }
                    mock_session.execute = AsyncMock(side_effect=[post_row, account_row])
                    mock_db_ctx.return_value = mock_session

                    result = await service.publish_post("post-3", "acc-1")

        assert result.success is True
        mock_mark.assert_called_once_with("post-3", "ig-post-999")


# ---------------------------------------------------------------------------
# TestEngagementCalc
# ---------------------------------------------------------------------------

class TestEngagementCalc:

    def test_instagram_er_formula(self):
        """Instagram ER = (likes + comments) / followers × 100."""
        from microservices.bs_audience_insights.engagement_calc import calculate_engagement_rate
        result = calculate_engagement_rate(
            "instagram",
            {"followers": 1000, "likes": 50, "comments": 10},
        )
        assert result.engagement_rate == pytest.approx(6.0, abs=0.01)
        assert result.formula_used == "(likes + comments) / followers × 100"

    def test_tiktok_er_formula(self):
        """TikTok ER = (likes + comments + shares) / views × 100."""
        from microservices.bs_audience_insights.engagement_calc import calculate_engagement_rate
        result = calculate_engagement_rate(
            "tiktok",
            {"views": 1000, "likes": 80, "comments": 10, "shares": 10},
        )
        assert result.engagement_rate == pytest.approx(10.0, abs=0.01)

    def test_er_benchmark_tiers(self):
        """Verify correct tier assignment for Instagram ER benchmarks."""
        from microservices.bs_audience_insights.engagement_calc import calculate_engagement_rate
        excellent = calculate_engagement_rate("instagram", {"followers": 1000, "likes": 70, "comments": 0})
        good      = calculate_engagement_rate("instagram", {"followers": 1000, "likes": 35, "comments": 0})
        low       = calculate_engagement_rate("instagram", {"followers": 1000, "likes": 5,  "comments": 0})

        assert excellent.tier == "excellent"   # 7% ≥ 6% threshold
        assert good.tier == "good"             # 3.5% ≥ 3% threshold
        assert low.tier == "low"               # 0.5% < 3% threshold


# ---------------------------------------------------------------------------
# TestPricingCalc
# ---------------------------------------------------------------------------

class TestPricingCalc:

    def test_niche_multiplier_finance(self):
        """Finance niche multiplier (3.0) should yield ~3× the base price of general."""
        from microservices.bs_audience_insights.pricing_calc import estimate_influencer_price
        finance = estimate_influencer_price("instagram", 100_000, 3.0, "finance", "post")
        general = estimate_influencer_price("instagram", 100_000, 3.0, "general", "post")
        ratio = finance.breakdown["base_price"] / general.breakdown["base_price"]
        assert ratio == pytest.approx(3.0, abs=0.01)

    def test_price_estimate_in_range(self):
        """min_price < base_price < max_price."""
        from microservices.bs_audience_insights.pricing_calc import estimate_influencer_price
        result = estimate_influencer_price("instagram", 50_000, 4.0, "beauty", "reel")
        assert result.min_price < result.breakdown["base_price"] < result.max_price
        assert result.currency == "EUR"


# ---------------------------------------------------------------------------
# TestContentFormatter
# ---------------------------------------------------------------------------

class TestContentFormatter:

    def test_grid_3x3_returns_9_tiles(self):
        """A 3x3 grid should produce exactly 9 JPEG tile bytes."""
        from microservices.bs_content_formatter.grid_maker import create_instagram_grid
        image_bytes = _make_test_image_bytes(3240, 3240)
        tiles = create_instagram_grid(image_bytes, "3x3")
        assert len(tiles) == 9
        for tile in tiles:
            assert isinstance(tile, bytes)
            assert len(tile) > 0

    def test_resize_correct_dimensions(self):
        """resize_to_formats should produce images with the requested dimensions."""
        from microservices.bs_content_formatter.image_resizer import resize_to_formats
        image_bytes = _make_test_image_bytes(2000, 1500)
        result = resize_to_formats(image_bytes, ["1080x1080", "1080x1920"])

        for fmt, data in result.items():
            w_str, h_str = fmt.split("x")
            img = Image.open(io.BytesIO(data))
            assert img.size == (int(w_str), int(h_str)), \
                f"Expected {fmt} but got {img.size}"

    def test_unicode_bold_conversion(self):
        """bold_unicode should map ASCII chars to Mathematical Bold codepoints."""
        from microservices.bs_content_formatter.text_formatter import bold_unicode
        result = bold_unicode("Hello")
        # All chars must be different from the originals (Unicode transformed)
        for orig, conv in zip("Hello", result):
            assert orig != conv, f"Char '{orig}' was not converted"
        # Length must be preserved
        assert len(result) == len("Hello")

    def test_split_into_thread(self):
        """A text > 280 chars should be split into multiple numbered tweets."""
        from microservices.bs_content_formatter.text_formatter import split_into_thread
        long_text = " ".join(["word"] * 100)  # 400+ chars
        tweets = split_into_thread(long_text, max_chars=280)
        assert len(tweets) > 1
        # Each tweet must be ≤ 280 chars
        for tweet in tweets:
            assert len(tweet) <= 280

    def test_count_characters_x_url_normalisation(self):
        """X platform should count URLs as 23 chars regardless of length."""
        from microservices.bs_content_formatter.text_formatter import count_characters
        text = "Check this out https://very-long-url-example.com/with/path/params?q=1&r=2 today!"
        result = count_characters(text, "x")
        # URL replaced by 23-char placeholder
        expected = len("Check this out " + "x" * 23 + " today!")
        assert result.character_count == expected

    def test_carousel_5_returns_5_tiles(self):
        """carousel_5 grid type should return 5 tiles."""
        from microservices.bs_content_formatter.grid_maker import create_instagram_grid
        image_bytes = _make_test_image_bytes(5400, 1080)
        tiles = create_instagram_grid(image_bytes, "carousel_5")
        assert len(tiles) == 5

    def test_unsupported_format_raises_value_error(self):
        """Requesting an unsupported image format should raise ValueError."""
        from microservices.bs_content_formatter.image_resizer import resize_to_formats
        image_bytes = _make_test_image_bytes()
        with pytest.raises(ValueError, match="Unsupported format"):
            resize_to_formats(image_bytes, ["9999x9999"])
