# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_text/main.py
# DESCRIPTION  : FastAPI entrypoint for bs_ai_text microservice (port 8001)
# ============================================================
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from microservices.bs_ai_text.api import router

app = FastAPI(
    title="BRANDSCALE — bs_ai_text",
    description="AI text generation microservice (posts, emails, ads, newsletters, video scripts)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

# Root-level health (required by backend health aggregator)
@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"service": "bs_ai_text", "status": "ok"}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("microservices.bs_ai_text.main:app", host="0.0.0.0", port=8001, reload=False)
