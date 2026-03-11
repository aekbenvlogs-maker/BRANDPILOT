# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/routes/projects.py
# DESCRIPTION  : FastAPI routes for Project CRUD endpoints
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

from typing import Annotated
import uuid

from database.connection import get_db_session
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.controllers.project_controller import (
    handle_create_project,
    handle_delete_project,
    handle_get_project,
    handle_list_projects,
    handle_update_project,
)
from backend.api.v1.models.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from backend.middleware.auth import get_current_user_id

router = APIRouter()


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> ProjectListResponse:
    """Return paginated list of projects for the authenticated user."""
    return await handle_list_projects(db, user_id, page, page_size, include_archived)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> ProjectResponse:
    """Create a new project."""
    return await handle_create_project(db, user_id, data)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> ProjectResponse:
    """Retrieve a specific project by ID."""
    return await handle_get_project(db, project_id, user_id)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> ProjectResponse:
    """Update a project's name, description or archive status."""
    return await handle_update_project(db, project_id, user_id, data)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> dict[str, str]:
    """Archive a project (soft delete)."""
    return await handle_delete_project(db, project_id, user_id)


@router.post(
    "/{project_id}/analyze-brand",
    response_model=dict,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_brand_analysis(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> dict[str, str]:
    """
    Queue brand analysis for an existing project.

    Fires the ``campaign_agent.analyze_brand`` Celery task asynchronously
    and returns immediately with the task ID.

    The pipeline runs in the background:
    scrape → tone analysis → visual analysis → competitor discovery → persist.
    Results are written to the ``brand_analyses`` table and ``project.tone``
    is updated on completion.

    Requires the project to have a ``brand_url`` set (either at creation time
    or via ``PUT /projects/{project_id}``). Returns **422** if not set.
    """
    from fastapi import HTTPException

    from microservices.campaign_agent.worker import analyze_brand as _brand_task

    project = await handle_get_project(db, project_id, user_id)
    if not getattr(project, "brand_url", None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Project has no brand_url. "
                "Set it via PUT /projects/{project_id} first, "
                "or provide it at project creation time."
            ),
        )
    task = _brand_task.delay(str(project_id))
    return {"task_id": task.id, "status": "queued", "project_id": str(project_id)}
