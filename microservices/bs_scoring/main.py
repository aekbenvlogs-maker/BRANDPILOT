# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_scoring/main.py
# DESCRIPTION  : FastAPI entrypoint for bs_scoring microservice (port 8005)
# ============================================================
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from microservices.bs_scoring.api import router

app = FastAPI(
    title="BRANDSCALE — bs_scoring",
    description="Lead scoring, tier classification and ranking microservice",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"service": "bs_scoring", "status": "ok"}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("microservices.bs_scoring.main:app", host="0.0.0.0", port=8005, reload=False)
