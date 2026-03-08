# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/controllers/project_controller.py
# DESCRIPTION  : Request orchestration for project endpoints
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from backend.api.v1.services import project_service


async def handle_create_project(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: ProjectCreate,
) -> ProjectResponse:
    """Create a project and return the response model."""
    project = await project_service.create_project(db, user_id, data)
    return ProjectResponse.model_validate(project)


async def handle_list_projects(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int,
    page_size: int,
    include_archived: bool,
) -> ProjectListResponse:
    """List projects with pagination."""
    projects, total = await project_service.list_projects(
        db, user_id, page, page_size, include_archived
    )
    return ProjectListResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        page=page,
        page_size=page_size,
    )


async def handle_get_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ProjectResponse:
    """Fetch a single project or raise 404."""
    project = await project_service.get_project(db, project_id, user_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )
    return ProjectResponse.model_validate(project)


async def handle_update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ProjectUpdate,
) -> ProjectResponse:
    """Update a project or raise 404."""
    project = await project_service.get_project(db, project_id, user_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )
    updated = await project_service.update_project(db, project, data)
    return ProjectResponse.model_validate(updated)


async def handle_delete_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict[str, str]:
    """Archive (soft-delete) a project or raise 404."""
    project = await project_service.get_project(db, project_id, user_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )
    await project_service.delete_project(db, project)
    return {"message": f"Project {project_id} archived successfully."}
