# ============================================================
# PROJECT      : BRANDPILOT — AI Brand Scaling Tool
# FILE         : microservices/bs_brand_analyzer/scraper.py
# DESCRIPTION  : Website scraper — static (httpx+BS4) with JS fallback (Playwright)
# AUTHOR       : BRANDPILOT Dev Team
# LAST UPDATED : 2026-03-10
# ============================================================
from __future__ import annotations

import re
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup
from loguru import logger

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class ScrapedContent:
    url: str
    title: str
    description: str
    main_text: str
    image_urls: list[str]
    og_data: dict[str, str]


# ---------------------------------------------------------------------------
# Robots.txt helper
# ---------------------------------------------------------------------------

async def _is_allowed(url: str) -> bool:
    """Return True if robots.txt permits scraping the URL."""
    parsed = urllib.parse.urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(robots_url)
            rp = urllib.robotparser.RobotFileParser()
            rp.parse(resp.text.splitlines())
            return rp.can_fetch("*", url)
    except Exception:
        return True  # assume allowed on fetch failure


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _extract_with_bs4(html: str, base_url: str) -> ScrapedContent:
    soup = BeautifulSoup(html, "lxml")

    title = soup.title.string.strip() if soup.title else ""

    desc_tag = soup.find("meta", attrs={"name": "description"})
    description = desc_tag["content"].strip() if desc_tag and desc_tag.get("content") else ""  # type: ignore[index]

    headings: list[str] = []
    for tag in soup.find_all(["h1", "h2", "h3"]):
        text = tag.get_text(separator=" ").strip()
        if text:
            headings.append(text)

    paragraphs: list[str] = []
    for p in soup.find_all("p"):
        text = p.get_text(separator=" ").strip()
        if text:
            paragraphs.append(text)

    combined = " ".join(headings + paragraphs)
    words = combined.split()
    main_text = " ".join(words[:500])

    image_urls: list[str] = []
    parsed_base = urllib.parse.urlparse(base_url)
    for img in soup.find_all("img", src=True):
        src: str = img["src"]
        if src.startswith("http"):
            image_urls.append(src)
        elif src.startswith("/"):
            image_urls.append(f"{parsed_base.scheme}://{parsed_base.netloc}{src}")

    og_data: dict[str, str] = {}
    for meta in soup.find_all("meta"):
        prop = meta.get("property", "") or meta.get("name", "")
        content = meta.get("content", "")
        if prop.startswith("og:") and content:
            og_data[prop] = content

    return ScrapedContent(
        url=base_url,
        title=title,
        description=description,
        main_text=main_text,
        image_urls=image_urls[:20],
        og_data=og_data,
    )


async def _scrape_static(url: str) -> ScrapedContent | None:
    """Try a plain httpx GET first (fast path)."""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            max_redirects=3,
            timeout=30,
        ) as client:
            resp = await client.get(url, headers={"User-Agent": "BrandpilotBot/1.0"})
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "html" not in content_type:
                return None
            return _extract_with_bs4(resp.text, url)
    except Exception as exc:
        logger.debug("[scraper] Static scrape failed url={} exc={}", url, exc)
        return None


async def _scrape_with_playwright(url: str) -> ScrapedContent:
    """JS-rendered fallback via Playwright headless Chromium."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=30_000)
            html = await page.content()
        finally:
            await browser.close()
    return _extract_with_bs4(html, url)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def scrape_website(url: str) -> ScrapedContent:
    """
    Scrape a website and return structured content.

    1. Checks robots.txt.
    2. Tries static httpx scrape.
    3. Falls back to Playwright for JS-heavy sites.
    """
    if not await _is_allowed(url):
        raise PermissionError(f"robots.txt disallows scraping: {url}")

    result = await _scrape_static(url)
    if result is not None and len(result.main_text) >= 100:
        logger.info("[scraper] Static scrape OK url={}", url)
        return result

    logger.info("[scraper] Falling back to Playwright url={}", url)
    return await _scrape_with_playwright(url)
