from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from fastapi import Header, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials

from .db import APIKey, Project, get_db

api_key_header = APIKeyHeader(name="X-Feenion-Api-Key", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)

def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

def generate_api_key(prefix: str = "fn_") -> str:
    return f"{prefix}{secrets.token_urlsafe(32)}"

def get_or_create_default_project(db: Session) -> Project:
    project = db.query(Project).filter(Project.name == "default").first()
    if not project:
        project = Project(name="default")
        db.add(project)
        db.commit()
        db.refresh(project)
    return project

def create_project_api_key(db: Session, project_id: str, name: str = "default_key") -> Tuple[str, APIKey]:
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)
    api_key_obj = APIKey(
        project_id=project_id,
        key_hash=key_hash,
        name=name,
    )
    db.add(api_key_obj)
    db.commit()
    db.refresh(api_key_obj)
    return raw_key, api_key_obj

def get_current_project(
    db: Session = Depends(get_db),
    header_key: str | None = Security(api_key_header),
    bearer_credentials: HTTPAuthorizationCredentials | None = Security(http_bearer),
    x_project_id: Optional[str] = Header(default=None, alias="X-Project-Id"),
    x_project_name: Optional[str] = Header(default=None, alias="X-Project-Name"),
) -> Project:
    # 1. Direct Project ID from UI header
    if x_project_id:
        proj = db.query(Project).filter(Project.id == x_project_id).first()
        if proj:
            return proj
        # If user passed a project name as project_id (e.g. "default")
        proj = db.query(Project).filter(Project.name == x_project_id).first()
        if proj:
            return proj

    # 2. Direct Project Name from UI header
    if x_project_name:
        proj = db.query(Project).filter(Project.name == x_project_name).first()
        if proj:
            return proj

    # 3. API Key Auth
    key_str = header_key
    if not key_str and bearer_credentials:
        key_str = bearer_credentials.credentials

    if key_str:
        key_hash = hash_api_key(key_str)
        api_key_record = db.query(APIKey).filter(APIKey.key_hash == key_hash, APIKey.revoked_at.is_(None)).first()
        if api_key_record and api_key_record.project:
            return api_key_record.project

    # 4. Fallback to default project
    return get_or_create_default_project(db)
