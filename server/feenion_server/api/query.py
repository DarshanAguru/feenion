from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_project, create_project_api_key, hash_api_key
from ..db import APIKey, EventModel, Project, SessionLocal, SpanModel, TraceModel, get_db

router = APIRouter(
    prefix="/api/v1",
    tags=["query"],
)

@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "created_at": p.created_at.isoformat(),
        }
        for p in projects
    ]

@router.post("/projects")
def create_project(name: str, db: Session = Depends(get_db)):
    existing = db.query(Project).filter(Project.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project with this name already exists")
    p = Project(name=name)
    db.add(p)
    db.commit()
    db.refresh(p)
    raw_key, api_key_obj = create_project_api_key(db, p.id, name=f"{name}-key")
    return {
        "project": {"id": p.id, "name": p.name, "created_at": p.created_at.isoformat()},
        "api_key": raw_key,
    }

@router.get("/traces")
def list_traces(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status: Optional[str] = None,
    name: Optional[str] = None,
    min_duration_ms: Optional[float] = None,
    max_duration_ms: Optional[float] = None,
    has_error: Optional[bool] = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    query = db.query(TraceModel).filter(TraceModel.project_id == project.id)

    if start_time:
        query = query.filter(TraceModel.start_time >= start_time)
    if end_time:
        query = query.filter(TraceModel.start_time <= end_time)
    if status:
        query = query.filter(TraceModel.status == status)
    if name:
        query = query.filter(TraceModel.name.ilike(f"%{name}%"))
    if min_duration_ms is not None:
        query = query.filter(TraceModel.duration_ms >= min_duration_ms)
    if max_duration_ms is not None:
        query = query.filter(TraceModel.duration_ms <= max_duration_ms)
    if has_error is True:
        query = query.filter(TraceModel.status == "error")

    total_count = query.count()
    traces = query.order_by(TraceModel.start_time.desc()).offset(offset).limit(limit).all()

    result = []
    for t in traces:
        # Calculate derived metrics
        span_count = len(t.spans)
        error_count = sum(1 for s in t.spans if s.status == "error")
        llm_span_count = sum(1 for s in t.spans if s.span_type == "llm")
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_cost = 0.0
        models_set = set()
        search_snippets = [t.name, str(t.id)]
        preview_prompt = None

        for s in t.spans:
            m = s.metrics_json or {}
            attr = s.attributes_json or {}
            tokens = m.get("tokens") or attr.get("tokens") or {}
            p_tok = tokens.get("prompt") or attr.get("prompt_tokens", 0)
            c_tok = tokens.get("completion") or attr.get("completion_tokens", 0)
            cost_val = m.get("cost") or attr.get("cost", 0.0)

            total_prompt_tokens += int(p_tok)
            total_completion_tokens += int(c_tok)
            total_cost += float(cost_val)

            # Extract model name
            model_name = attr.get("model") or m.get("model")
            if model_name:
                models_set.add(str(model_name))
                search_snippets.append(str(model_name))

            # Extract search text from span name and inputs
            search_snippets.append(s.name)
            if s.input_json:
                if isinstance(s.input_json, dict):
                    q_text = s.input_json.get("query") or s.input_json.get("question") or s.input_json.get("prompt") or s.input_json.get("input")
                    if q_text and not preview_prompt:
                        preview_prompt = str(q_text)
                    for val in s.input_json.values():
                        if isinstance(val, (str, int, float)):
                            search_snippets.append(str(val))
                        elif isinstance(val, list):
                            for item in val:
                                if isinstance(item, dict) and "content" in item:
                                    search_snippets.append(str(item["content"]))
                                    if not preview_prompt and item.get("role") == "user":
                                        preview_prompt = str(item["content"])
                elif isinstance(s.input_json, str):
                    search_snippets.append(s.input_json)
                    if not preview_prompt:
                        preview_prompt = s.input_json

        result.append({
            "trace_id": str(t.id),
            "name": t.name,
            "status": t.status,
            "start_time": t.start_time.isoformat(),
            "end_time": t.end_time.isoformat() if t.end_time else None,
            "duration_ms": t.duration_ms,
            "span_count": span_count,
            "error_count": error_count,
            "llm_span_count": llm_span_count,
            "models": list(models_set),
            "preview_prompt": (preview_prompt[:80] + "...") if preview_prompt and len(preview_prompt) > 80 else preview_prompt,
            "search_text": " ".join(search_snippets),
            "tokens": {
                "prompt": total_prompt_tokens,
                "completion": total_completion_tokens,
                "total": total_prompt_tokens + total_completion_tokens,
            },
            "estimated_cost": total_cost,
            "metadata": t.metadata_json or {},
        })

    return {
        "traces": result,
        "total": total_count,
        "limit": limit,
        "offset": offset,
    }

@router.get("/traces/{trace_id}/spans")
def get_trace_spans(trace_id: UUID, db: Session = Depends(get_db)):
    spans = db.query(SpanModel).filter(SpanModel.trace_id == str(trace_id)).all()
    if not spans:
        raise HTTPException(status_code=404, detail="Spans not found for trace")

    return [
        {
            "span_id": str(s.id),
            "trace_id": str(s.trace_id),
            "parent_span_id": str(s.parent_span_id) if s.parent_span_id else None,
            "name": s.name,
            "span_type": s.span_type,
            "status": s.status,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat() if s.end_time else None,
            "duration_ms": s.duration_ms,
            "attributes": s.attributes_json or {},
            "input": s.input_json,
            "output": s.output_json,
            "error": s.error_json,
            "metrics": s.metrics_json or {},
        }
        for s in spans
    ]

@router.get("/errors")
def list_errors(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    error_spans = (
        db.query(SpanModel)
        .join(TraceModel)
        .filter(TraceModel.project_id == project.id, SpanModel.status == "error")
        .order_by(SpanModel.start_time.desc())
        .limit(limit)
        .all()
    )

    grouped_errors: dict[str, dict[str, Any]] = {}
    for s in error_spans:
        err = s.error_json or {}
        err_type = err.get("error_type", "UnknownError")
        err_msg = err.get("message", "No error message")
        fingerprint = f"{err_type}:{err_msg}"

        if fingerprint not in grouped_errors:
            grouped_errors[fingerprint] = {
                "error_type": err_type,
                "message": err_msg,
                "count": 0,
                "latest_occurrence": s.start_time.isoformat(),
                "sample_span_id": str(s.id),
                "sample_trace_id": str(s.trace_id),
                "stack_trace": err.get("stack_trace"),
            }
        grouped_errors[fingerprint]["count"] += 1

    return {
        "errors": list(grouped_errors.values()),
        "total_error_spans": len(error_spans),
    }

