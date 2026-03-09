# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : microservices/bs_email/main.py
# DESCRIPTION  : FastAPI entrypoint for bs_email microservice (port 8004)
# ============================================================
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from microservices.bs_email.api import router

app = FastAPI(
    title="BRANDSCALE — bs_email",
    description="Email sequence creation, delivery, tracking and RGPD microservice",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"service": "bs_email", "status": "ok"}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("microservices.bs_email.main:app", host="0.0.0.0", port=8004, reload=False)
