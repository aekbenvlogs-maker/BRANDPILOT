# ============================================================
# PROJECT      : BRANDSCALE — AI Brand Scaling Tool
# FILE         : backend/api/v1/services/project_service.py
# DESCRIPTION  : Business logic for Project CRUD operations
# AUTHOR       : BRANDSCALE Dev Team
# WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
# PYTHON       : 3.11.9
# LAST UPDATED : 2026-03-08
# ============================================================

from __future__ import annotations

import uuid
from typing import Optional

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.models.project import ProjectCreate, ProjectUpdate
from database.models_orm import Project


async def create_project(
    db: AsyncSession, user_id: uuid.UUID, data: ProjectCreate
) -> Project:
    """
    Create a new project owned by the given user.

    Args:
        db:      Async database session.
        user_id: UUID of the project owner.
        data:    Validated project creation payload.

    Returns:
        Newly created Project ORM instance.
    """
    project = Project(
        user_id=user_id,
        name=data.name,
        description=data.description,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    logger.info("[BRANDSCALE] Project created | id={} name={}", project.id, project.name)
    return project


async def list_projects(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    include_archived: bool = False,
) -> tuple[list[Project], int]:
    """
    Return paginated list of projects for a user.

    Args:
        db:               Async database session.
        user_id:          Filter by owner UUID.
        page:             Page number (1-indexed).
        page_size:        Items per page.
        include_archived: Include archived projects if True.

    Returns:
        Tuple of (project list, total count).
    """
    base_query = select(Project).where(Project.user_id == user_id)
    if not include_archived:
        base_query = base_query.where(Project.archived.is_(False))

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    result = await db.execute(
        base_query.order_by(Project.created_at.desc()).offset(offset).limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_project(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[Project]:
    """
    Fetch a single project by ID, scoped to the user.

    Args:
        db:         Async database session.
        project_id: Project UUID.
        user_id:    Owner user UUID (for authorisation).

    Returns:
        Project ORM object or None.
    """
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_project(
    db: AsyncSession,
    project: Project,
    data: ProjectUpdate,
) -> Project:
    """
    Apply partial updates to an existing project.

    Args:
        db:      Async database session.
        project: Existing Project ORM object.
        data:    Validated update payload.

    Returns:
        Updated Project ORM instance.
    """
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    await db.flush()
    await db.refresh(project)
    logger.info("[BRANDSCALE] Project updated | id={}", project.id)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    """
    Soft-delete (archive) a project.

    Args:
        db:      Async database session.
        project: Project ORM object to archive.
    """
    project.archived = True
    await db.flush()
    logger.info("[BRANDSCALE] Project archived | id={}", project.id)


if __name__ == "__main__":
    print("[BRANDSCALE] project_service.py loaded")
