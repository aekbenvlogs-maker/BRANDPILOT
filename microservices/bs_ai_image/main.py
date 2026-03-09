# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_ai_image/main.py
# DESCRIPTION  : FastAPI entrypoint for bs_ai_image microservice (port 8002)
# ============================================================
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from microservices.bs_ai_image.api import router

app = FastAPI(
    title="BRANDSCALE — bs_ai_image",
    description="AI image generation microservice (marketing visuals)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"service": "bs_ai_image", "status": "ok"}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("microservices.bs_ai_image.main:app", host="0.0.0.0", port=8002, reload=False)
