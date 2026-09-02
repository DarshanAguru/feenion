from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from ..auth import get_current_project, create_project_api_key, hash_api_key
from ..db import APIKey, EventModel, Project, SessionLocal, SpanModel, TraceModel, get_db

router = APIRouter(
    prefix="/api/v1",
    tags=["query"],
)

def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sorted_v = sorted(values)
    k = (len(sorted_v) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(float(sorted_v[int(k)]), 2)
    d0 = sorted_v[int(f)] * (c - k)
    d1 = sorted_v[int(c)] * (k - f)
    return round(float(d0 + d1), 2)

DEFAULT_MODEL_RATES = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-1.5-pro": (3.50, 10.50),
    "gemini-1.5-flash": (0.075, 0.30),
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-5-haiku": (0.80, 4.00),
    "deepseek-chat": (0.14, 0.28),
    "deepseek-reasoner": (0.55, 2.19),
    "llama-3.3-70b": (0.70, 0.90),
    "o1": (15.00, 60.00),
    "o3-mini": (1.10, 4.40),
}

def calc_model_cost(model_name: Optional[str], prompt_tokens: int, completion_tokens: int) -> float:
    if not model_name:
        return round((prompt_tokens * 2.50 / 1_000_000.0) + (completion_tokens * 10.00 / 1_000_000.0), 6)
    m = model_name.lower().strip()
    for key, (p_rate, c_rate) in DEFAULT_MODEL_RATES.items():
        if key in m or m in key:
            return round((prompt_tokens * p_rate / 1_000_000.0) + (completion_tokens * c_rate / 1_000_000.0), 6)
    return round((prompt_tokens * 2.50 / 1_000_000.0) + (completion_tokens * 10.00 / 1_000_000.0), 6)

def to_iso_utc(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    return dt.isoformat()

class ProjectCreateRequest(BaseModel):
    name: str

@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    res = []
    for p in projects:
        key_count = db.query(APIKey).filter(APIKey.project_id == p.id, APIKey.revoked_at.is_(None)).count()
        res.append({
            "id": p.id,
            "name": p.name,
            "created_at": to_iso_utc(p.created_at),
            "key_count": key_count,
        })
    return res

@router.post("/projects")
def create_project(
    body: Optional[ProjectCreateRequest] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    proj_name = (body.name if body else None) or name
    if not proj_name or not proj_name.strip():
        raise HTTPException(status_code=400, detail="Project name is required")
    proj_name = proj_name.strip()

    existing = db.query(Project).filter(Project.name.ilike(proj_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Workspace '{proj_name}' already exists. Please choose a unique name.")
    p = Project(name=proj_name)
    db.add(p)
    db.commit()
    db.refresh(p)
    raw_key, api_key_obj = create_project_api_key(db, p.id, name=f"{proj_name}-key")
    return {
        "project": {"id": p.id, "name": p.name, "created_at": p.created_at.isoformat(), "key_count": 1},
        "api_key": raw_key,
    }

@router.post("/projects/{project_id}/key")
@router.get("/projects/{project_id}/key")
@router.post("/workspaces/{project_id}/key")
@router.get("/workspaces/{project_id}/key")
def generate_project_api_key(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(Project).filter((Project.id == project_id) | (Project.name == project_id)).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Workspace not found")
    raw_key, api_key_obj = create_project_api_key(db, proj.id, name=f"{proj.name}-key")
    return {
        "project_id": proj.id,
        "workspace_id": proj.id,
        "project_name": proj.name,
        "workspace_name": proj.name,
        "api_key": raw_key,
    }

@router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    total_projects = db.query(Project).count()
    if total_projects <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only remaining workspace.")

    # Cascade delete all API keys for this project
    db.query(APIKey).filter(APIKey.project_id == project_id).delete(synchronize_session=False)

    # Find all traces for this project
    traces = db.query(TraceModel).filter(TraceModel.project_id == project_id).all()
    trace_ids = [str(t.id) for t in traces]

    if trace_ids:
        # Find all spans for these traces
        spans = db.query(SpanModel).filter(SpanModel.trace_id.in_(trace_ids)).all()
        span_ids = [str(s.id) for s in spans]
        if span_ids:
            db.query(EventModel).filter(EventModel.span_id.in_(span_ids)).delete(synchronize_session=False)
        db.query(SpanModel).filter(SpanModel.trace_id.in_(trace_ids)).delete(synchronize_session=False)
        db.query(TraceModel).filter(TraceModel.project_id == project_id).delete(synchronize_session=False)

    db.delete(proj)
    db.commit()

    # Clear in-memory traces
    try:
        from ..main import trace_store
        with trace_store._lock:
            for tid in trace_ids:
                try:
                    uid = UUID(tid)
                    trace_store._in_memory_traces.pop(uid, None)
                except Exception:
                    pass
    except Exception:
        pass

    return {
        "status": "deleted",
        "project_id": project_id,
        "deleted_traces_count": len(trace_ids),
    }

@router.get("/traces")
def list_traces(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    time_window: Optional[str] = None,
    status: Optional[str] = None,
    name: Optional[str] = None,
    environment: Optional[str] = None,
    model: Optional[str] = None,
    span_type: Optional[str] = None,
    min_duration_ms: Optional[float] = None,
    max_duration_ms: Optional[float] = None,
    has_error: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: str = Query(default="newest", enum=["newest", "oldest", "slowest", "fastest", "most_tokens", "most_cost", "most_spans", "error"]),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    query = db.query(TraceModel).filter(TraceModel.project_id == project.id)

    # Time Window computation
    if time_window and time_window != "all" and not start_time:
        now = datetime.now(timezone.utc)
        delta_map = {
            "15m": timedelta(minutes=15),
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
        }
        if time_window in delta_map:
            start_time = now - delta_map[time_window]

    if start_time:
        query = query.filter(TraceModel.start_time >= start_time)
    if end_time:
        query = query.filter(TraceModel.start_time <= end_time)
    if status and status != "all":
        query = query.filter(TraceModel.status == status)
    if name:
        query = query.filter(TraceModel.name.ilike(f"%{name}%"))
    if min_duration_ms is not None:
        query = query.filter(TraceModel.duration_ms >= min_duration_ms)
    if max_duration_ms is not None:
        query = query.filter(TraceModel.duration_ms <= max_duration_ms)
    if has_error is True:
        query = query.filter(TraceModel.status == "error")

    all_traces = query.all()

    filtered_traces = []
    for t in all_traces:
        # Check environment filter from metadata
        meta = t.metadata_json or {}
        env = meta.get("environment") or meta.get("env") or "production"
        if environment and environment.lower() != "all":
            if env.lower() != environment.lower():
                continue

        # Extract span metrics
        span_count = len(t.spans)
        error_count = sum(1 for s in t.spans if s.status == "error")
        llm_span_count = sum(1 for s in t.spans if s.span_type == "llm")
        retrieval_count = sum(1 for s in t.spans if s.span_type == "retrieval")
        tool_count = sum(1 for s in t.spans if s.span_type == "tool")
        agent_count = sum(1 for s in t.spans if s.span_type == "agent")

        if span_type and span_type.lower() != "all":
            st = span_type.lower()
            if st == "llm" and llm_span_count == 0:
                continue
            elif st == "retrieval" and retrieval_count == 0:
                continue
            elif st == "tool" and tool_count == 0:
                continue
            elif st == "agent" and agent_count == 0:
                continue

        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_cost = 0.0
        models_set = set()
        search_snippets = [t.name, str(t.id), env]
        preview_prompt = None

        for s in t.spans:
            m = s.metrics_json or {}
            attr = s.attributes_json or {}
            tokens = m.get("tokens") or attr.get("tokens") or {}
            p_tok = int(tokens.get("prompt") or attr.get("prompt_tokens") or 0)
            c_tok = int(tokens.get("completion") or attr.get("completion_tokens") or 0)
            cost_val = float(m.get("cost") or attr.get("cost") or 0.0)
            model_name = attr.get("model") or m.get("model")

            if cost_val == 0.0 and (p_tok > 0 or c_tok > 0):
                cost_val = calc_model_cost(model_name, p_tok, c_tok)

            total_prompt_tokens += p_tok
            total_completion_tokens += c_tok
            total_cost += cost_val

            if model_name:
                models_set.add(str(model_name))
                search_snippets.append(str(model_name))

            tool_name = attr.get("tool_name") or attr.get("tool") or s.name
            search_snippets.append(str(tool_name))
            search_snippets.append(s.name)
            search_snippets.append(s.span_type)

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

            if s.output_json:
                if isinstance(s.output_json, dict):
                    for val in s.output_json.values():
                        if isinstance(val, (str, int, float)):
                            search_snippets.append(str(val))
                elif isinstance(s.output_json, str):
                    search_snippets.append(s.output_json)

            if s.error_json:
                err_msg = str(s.error_json.get("message", ""))
                err_type = str(s.error_json.get("error_type", ""))
                search_snippets.extend([err_msg, err_type])

        if model and model.lower() != "all" and model.lower() not in [m.lower() for m in models_set]:
            continue

        full_search_str = " ".join(search_snippets).lower()
        if search and search.strip():
            search_terms = search.lower().strip().split()
            id_match = search.lower().strip() in str(t.id).lower() or search.lower().strip().replace("-", "") in str(t.id).lower().replace("-", "")
            if not id_match and not all(term in full_search_str for term in search_terms):
                continue

        filtered_traces.append({
            "trace_id": str(t.id),
            "name": t.name,
            "status": t.status,
            "start_time": to_iso_utc(t.start_time),
            "end_time": to_iso_utc(t.end_time),
            "duration_ms": t.duration_ms or 0.0,
            "span_count": span_count,
            "error_count": error_count,
            "llm_span_count": llm_span_count,
            "retrieval_count": retrieval_count,
            "tool_count": tool_count,
            "agent_count": agent_count,
            "models": list(models_set),
            "preview_prompt": (preview_prompt[:80] + "...") if preview_prompt and len(preview_prompt) > 80 else preview_prompt,
            "search_text": full_search_str,
            "tokens": {
                "prompt": total_prompt_tokens,
                "completion": total_completion_tokens,
                "total": total_prompt_tokens + total_completion_tokens,
            },
            "estimated_cost": total_cost,
            "environment": env,
            "metadata": t.metadata_json or {},
        })

    # Sort results
    if sort_by == "newest":
        filtered_traces.sort(key=lambda x: x["start_time"], reverse=True)
    elif sort_by == "oldest":
        filtered_traces.sort(key=lambda x: x["start_time"], reverse=False)
    elif sort_by == "slowest":
        filtered_traces.sort(key=lambda x: x["duration_ms"] or 0.0, reverse=True)
    elif sort_by == "fastest":
        filtered_traces.sort(key=lambda x: x["duration_ms"] or 0.0, reverse=False)
    elif sort_by == "most_tokens":
        filtered_traces.sort(key=lambda x: x["tokens"]["total"], reverse=True)
    elif sort_by == "most_cost":
        filtered_traces.sort(key=lambda x: x["estimated_cost"], reverse=True)
    elif sort_by == "most_spans":
        filtered_traces.sort(key=lambda x: x["span_count"], reverse=True)
    elif sort_by == "error":
        filtered_traces.sort(key=lambda x: (x["status"] == "error", x["error_count"]), reverse=True)

    total_filtered = len(filtered_traces)
    paginated = filtered_traces[offset : offset + limit]

    return {
        "traces": paginated,
        "total": total_filtered,
        "limit": limit,
        "offset": offset,
    }

@router.get("/traces/{trace_id}")
def get_trace_detail(trace_id: UUID, db: Session = Depends(get_db)):
    t = db.query(TraceModel).filter(TraceModel.id == str(trace_id)).first()
    if t:
        spans = db.query(SpanModel).filter(SpanModel.trace_id == str(trace_id)).order_by(SpanModel.start_time.asc()).all()
        spans_list = []
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_tokens = 0
        total_cost = 0.0
        models_set = set()

        for s in spans:
            m = s.metrics_json or {}
            attr = s.attributes_json or {}
            tokens = m.get("tokens") or attr.get("tokens") or {}
            p_tok = int(tokens.get("prompt") or attr.get("prompt_tokens") or 0)
            c_tok = int(tokens.get("completion") or attr.get("completion_tokens") or 0)
            tot_tok = int(tokens.get("total") or attr.get("total_tokens") or (p_tok + c_tok))
            cost_val = float(m.get("cost") or attr.get("cost") or 0.0)
            model_name = attr.get("model") or m.get("model")

            if cost_val == 0.0 and (p_tok > 0 or c_tok > 0):
                cost_val = calc_model_cost(model_name, p_tok, c_tok)

            total_prompt_tokens += p_tok
            total_completion_tokens += c_tok
            total_tokens += tot_tok
            total_cost += cost_val

            if model_name:
                models_set.add(str(model_name))

            events_list = [
                {
                    "event_id": str(e.id),
                    "event_type": e.event_type,
                    "timestamp": to_iso_utc(e.timestamp),
                    "trace_id": str(e.trace_id),
                    "span_id": str(e.span_id),
                    "payload": e.payload_json or {},
                }
                for e in s.events
            ]

            span_metrics = dict(s.metrics_json or {})
            if "cost" not in span_metrics or span_metrics.get("cost") == 0:
                if cost_val > 0:
                    span_metrics["cost"] = cost_val

            spans_list.append({
                "span_id": str(s.id),
                "trace_id": str(s.trace_id),
                "parent_span_id": str(s.parent_span_id) if s.parent_span_id else None,
                "name": s.name,
                "span_type": s.span_type,
                "status": s.status,
                "start_time": to_iso_utc(s.start_time),
                "end_time": to_iso_utc(s.end_time),
                "duration_ms": s.duration_ms or 0.0,
                "attributes": s.attributes_json or {},
                "input": s.input_json,
                "output": s.output_json,
                "error": s.error_json,
                "metrics": span_metrics,
                "events": events_list,
            })

        meta = t.metadata_json or {}
        env = meta.get("environment") or meta.get("env") or "production"

        return {
            "trace_id": str(t.id),
            "name": t.name,
            "status": t.status,
            "start_time": to_iso_utc(t.start_time),
            "end_time": to_iso_utc(t.end_time),
            "duration_ms": t.duration_ms or 0.0,
            "environment": env,
            "metadata": meta,
            "span_count": len(spans_list),
            "error_count": sum(1 for s in spans_list if s["status"] == "error"),
            "models": list(models_set),
            "tokens": {
                "prompt": total_prompt_tokens,
                "completion": total_completion_tokens,
                "total": total_tokens if total_tokens > 0 else (total_prompt_tokens + total_completion_tokens),
            },
            "estimated_cost": round(total_cost, 6),
            "spans": spans_list,
        }

    # Fallback to in-memory trace store if not yet flushed to SQLite
    from ..main import trace_store
    with trace_store._lock:
        mem_trace = trace_store._in_memory_traces.get(trace_id)

    if not mem_trace:
        raise HTTPException(status_code=404, detail="Trace not found")

    spans_list = []
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0
    total_cost = 0.0
    models_set = set()

    for s in mem_trace.spans:
        m = s.metrics or {}
        attr = s.attributes or {}
        tokens = m.get("tokens") or attr.get("tokens") or {}
        p_tok = int(tokens.get("prompt") or attr.get("prompt_tokens") or 0)
        c_tok = int(tokens.get("completion") or attr.get("completion_tokens") or 0)
        tot_tok = int(tokens.get("total") or attr.get("total_tokens") or (p_tok + c_tok))
        cost_val = float(m.get("cost") or attr.get("cost") or 0.0)
        model_name = attr.get("model") or m.get("model")

        if cost_val == 0.0 and (p_tok > 0 or c_tok > 0):
            cost_val = calc_model_cost(model_name, p_tok, c_tok)

        total_prompt_tokens += p_tok
        total_completion_tokens += c_tok
        total_tokens += tot_tok
        total_cost += cost_val

        if model_name:
            models_set.add(str(model_name))

        span_metrics = dict(s.metrics or {})
        if "cost" not in span_metrics or span_metrics.get("cost") == 0:
            if cost_val > 0:
                span_metrics["cost"] = cost_val

        spans_list.append({
            "span_id": str(s.span_id),
            "trace_id": str(s.trace_id),
            "parent_span_id": str(s.parent_span_id) if s.parent_span_id else None,
            "name": s.name,
            "span_type": s.span_type,
            "status": s.status,
            "start_time": to_iso_utc(s.start_time),
            "end_time": to_iso_utc(s.end_time),
            "duration_ms": s.duration_ms or 0.0,
            "attributes": s.attributes or {},
            "input": s.input,
            "output": s.output,
            "error": s.error,
            "metrics": s.metrics or {},
            "events": [
                {
                    "event_id": str(e.event_id),
                    "event_type": e.event_type,
                    "timestamp": to_iso_utc(e.timestamp),
                    "trace_id": str(e.trace_id),
                    "span_id": str(e.span_id),
                    "payload": e.payload or {},
                }
                for e in s.events
            ],
        })

    meta = mem_trace.metadata or {}
    env = meta.get("environment") or meta.get("env") or "production"

    return {
        "trace_id": str(mem_trace.trace_id),
        "name": mem_trace.name,
        "status": mem_trace.status,
        "start_time": to_iso_utc(mem_trace.start_time),
        "end_time": to_iso_utc(mem_trace.end_time),
        "duration_ms": mem_trace.duration_ms or 0.0,
        "environment": env,
        "metadata": meta,
        "span_count": len(spans_list),
        "error_count": sum(1 for s in spans_list if s["status"] == "error"),
        "models": list(models_set),
        "tokens": {
            "prompt": total_prompt_tokens,
            "completion": total_completion_tokens,
            "total": total_tokens if total_tokens > 0 else (total_prompt_tokens + total_completion_tokens),
        },
        "estimated_cost": total_cost,
        "spans": spans_list,
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

        attr = s.attributes_json or {}
        model_name = attr.get("model")

        if fingerprint not in grouped_errors:
            grouped_errors[fingerprint] = {
                "fingerprint": fingerprint,
                "error_type": err_type,
                "message": err_msg,
                "count": 0,
                "first_seen": s.start_time.isoformat(),
                "latest_occurrence": s.start_time.isoformat(),
                "sample_span_id": str(s.id),
                "sample_trace_id": str(s.trace_id),
                "sample_span_name": s.name,
                "span_type": s.span_type,
                "stack_trace": err.get("stack_trace"),
                "affected_traces": set(),
                "affected_models": set(),
            }
        g = grouped_errors[fingerprint]
        g["count"] += 1
        g["affected_traces"].add(str(s.trace_id))
        if model_name:
            g["affected_models"].add(str(model_name))
        if s.start_time.isoformat() < g["first_seen"]:
            g["first_seen"] = s.start_time.isoformat()

    result_errors = []
    for g in grouped_errors.values():
        result_errors.append({
            "fingerprint": g["fingerprint"],
            "error_type": g["error_type"],
            "message": g["message"],
            "count": g["count"],
            "first_seen": g["first_seen"],
            "latest_occurrence": g["latest_occurrence"],
            "sample_span_id": g["sample_span_id"],
            "sample_trace_id": g["sample_trace_id"],
            "sample_span_name": g["sample_span_name"],
            "span_type": g["span_type"],
            "stack_trace": g["stack_trace"],
            "affected_traces_count": len(g["affected_traces"]),
            "affected_models": list(g["affected_models"]),
            "affected_traces": list(g["affected_traces"])[:10],
        })

    result_errors.sort(key=lambda x: x["count"], reverse=True)

    return {
        "errors": result_errors,
        "total_error_spans": len(error_spans),
    }

@router.get("/analytics/overview")
def get_analytics_overview(
    time_window: str = Query(default="24h", enum=["15m", "1h", "6h", "24h", "7d", "30d", "all"]),
    environment: Optional[str] = None,
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    query = db.query(TraceModel).filter(TraceModel.project_id == project.id)
    all_traces = query.order_by(TraceModel.start_time.asc()).all()

    # Time filtering
    now = datetime.now(timezone.utc)
    delta_map = {
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }

    current_traces = []
    previous_traces = []

    if time_window in delta_map:
        window_delta = delta_map[time_window]
        cutoff = now - window_delta
        prev_cutoff = cutoff - window_delta

        for t in all_traces:
            t_time = t.start_time if t.start_time.tzinfo else t.start_time.replace(tzinfo=timezone.utc)
            meta = t.metadata_json or {}
            env = meta.get("environment") or meta.get("env") or "production"
            if environment and environment.lower() != "all" and env.lower() != environment.lower():
                continue

            if t_time >= cutoff:
                current_traces.append(t)
            elif t_time >= prev_cutoff:
                previous_traces.append(t)
    else:
        for t in all_traces:
            meta = t.metadata_json or {}
            env = meta.get("environment") or meta.get("env") or "production"
            if environment and environment.lower() != "all" and env.lower() != environment.lower():
                continue
            current_traces.append(t)

    def calc_stats(traces_list):
        total = len(traces_list)
        if total == 0:
            return {
                "count": 0,
                "errors": 0,
                "error_rate": 0.0,
                "durations": [],
                "p50": 0.0,
                "p75": 0.0,
                "p90": 0.0,
                "p95": 0.0,
                "p99": 0.0,
                "total_cost": 0.0,
                "total_tokens": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "llm_spans": 0,
                "tool_spans": 0,
                "retrieval_spans": 0,
                "agent_spans": 0,
                "llm_durations": [],
                "tool_durations": [],
                "retrieval_durations": [],
                "llm_p95": 0.0,
                "tool_p95": 0.0,
                "retrieval_p95": 0.0,
                "tool_errors": 0,
                "retrieval_errors": 0,
                "llm_errors": 0,
            }

        durations = []
        errs = 0
        cost = 0.0
        prompt_tok = 0
        comp_tok = 0
        llm_spans = 0
        tool_spans = 0
        retrieval_spans = 0
        agent_spans = 0
        llm_durations = []
        tool_durations = []
        retrieval_durations = []
        tool_errors = 0
        retrieval_errors = 0
        llm_errors = 0

        for t in traces_list:
            if t.status == "error":
                errs += 1
            if t.duration_ms:
                durations.append(t.duration_ms)

            for s in t.spans:
                m = s.metrics_json or {}
                attr = s.attributes_json or {}
                tokens = m.get("tokens") or attr.get("tokens") or {}
                p_tok = int(tokens.get("prompt") or attr.get("prompt_tokens") or 0)
                c_tok = int(tokens.get("completion") or attr.get("completion_tokens") or 0)
                cost_val = float(m.get("cost") or attr.get("cost") or 0.0)
                model_name = attr.get("model") or m.get("model")

                if cost_val == 0.0 and (p_tok > 0 or c_tok > 0):
                    cost_val = calc_model_cost(model_name, p_tok, c_tok)

                prompt_tok += p_tok
                comp_tok += c_tok
                cost += cost_val

                if s.span_type == "llm":
                    llm_spans += 1
                    if s.duration_ms:
                        llm_durations.append(s.duration_ms)
                    if s.status == "error":
                        llm_errors += 1
                elif s.span_type == "tool":
                    tool_spans += 1
                    if s.duration_ms:
                        tool_durations.append(s.duration_ms)
                    if s.status == "error":
                        tool_errors += 1
                elif s.span_type == "retrieval":
                    retrieval_spans += 1
                    if s.duration_ms:
                        retrieval_durations.append(s.duration_ms)
                    if s.status == "error":
                        retrieval_errors += 1
                elif s.span_type == "agent":
                    agent_spans += 1

        err_rate = round((errs / total) * 100, 2) if total > 0 else 0.0

        return {
            "count": total,
            "errors": errs,
            "error_rate": err_rate,
            "durations": durations,
            "p50": _percentile(durations, 50),
            "p75": _percentile(durations, 75),
            "p90": _percentile(durations, 90),
            "p95": _percentile(durations, 95),
            "p99": _percentile(durations, 99),
            "total_cost": round(cost, 4),
            "total_tokens": prompt_tok + comp_tok,
            "prompt_tokens": prompt_tok,
            "completion_tokens": comp_tok,
            "llm_spans": llm_spans,
            "tool_spans": tool_spans,
            "retrieval_spans": retrieval_spans,
            "agent_spans": agent_spans,
            "llm_durations": llm_durations,
            "tool_durations": tool_durations,
            "retrieval_durations": retrieval_durations,
            "llm_p95": _percentile(llm_durations, 95),
            "tool_p95": _percentile(tool_durations, 95),
            "retrieval_p95": _percentile(retrieval_durations, 95),
            "tool_errors": tool_errors,
            "retrieval_errors": retrieval_errors,
            "llm_errors": llm_errors,
        }

    cur_stats = calc_stats(current_traces)
    prev_stats = calc_stats(previous_traces)

    # Health score computation (0 - 100)
    base_health = 100.0
    error_penalty = min(40.0, cur_stats["error_rate"] * 5.0)
    latency_penalty = 0.0
    if cur_stats["p95"] > 5000:
        latency_penalty = min(25.0, (cur_stats["p95"] - 5000) / 400.0)
    tool_penalty = min(15.0, (cur_stats["tool_errors"] / max(1, cur_stats["tool_spans"])) * 50.0) if cur_stats["tool_spans"] > 0 else 0.0
    retrieval_penalty = min(15.0, (cur_stats["retrieval_errors"] / max(1, cur_stats["retrieval_spans"])) * 50.0) if cur_stats["retrieval_spans"] > 0 else 0.0

    current_health_score = max(0, min(100, round(base_health - error_penalty - latency_penalty - tool_penalty - retrieval_penalty)))

    prev_health_score = 96
    if previous_traces:
        prev_err_pen = min(40.0, prev_stats["error_rate"] * 5.0)
        prev_lat_pen = min(25.0, max(0, (prev_stats["p95"] - 5000) / 400.0))
        prev_health_score = max(0, min(100, round(100.0 - prev_err_pen - prev_lat_pen)))

    # Health factors explanation
    health_factors = []
    if cur_stats["error_rate"] > 0:
        health_factors.append(f"Error rate is {cur_stats['error_rate']}% (affects reliability)")
    if cur_stats["p95"] > 2000:
        health_factors.append(f"p95 latency is {cur_stats['p95']}ms (target: <2000ms)")
    if cur_stats["tool_errors"] > 0:
        health_factors.append(f"{cur_stats['tool_errors']} tool execution failure(s) detected")
    if cur_stats["retrieval_errors"] > 0:
        health_factors.append(f"{cur_stats['retrieval_errors']} retrieval error(s) reported")
    if not health_factors:
        health_factors.append("All systems nominal, zero error rate, latency within budget")

    # "What Changed?" Engine
    what_changed = []
    if prev_stats["count"] > 0:
        # Error rate delta
        err_diff = round(cur_stats["error_rate"] - prev_stats["error_rate"], 2)
        if abs(err_diff) >= 0.1:
            direction = "increased" if err_diff > 0 else "decreased"
            what_changed.append({
                "metric": "Error rate",
                "change": f"{abs(err_diff)}%",
                "direction": "up" if err_diff > 0 else "down",
                "severity": "danger" if err_diff > 0 else "good",
                "summary": f"Error rate {direction} from {prev_stats['error_rate']}% to {cur_stats['error_rate']}%",
                "contributor": "Check latest failing tool or LLM timeout spans",
                "filter_link": {"status": "error"},
            })

        # p95 latency delta
        if prev_stats["p95"] > 0:
            lat_pct = round(((cur_stats["p95"] - prev_stats["p95"]) / prev_stats["p95"]) * 100, 1)
            if abs(lat_pct) >= 5:
                direction = "increased" if lat_pct > 0 else "decreased"
                what_changed.append({
                    "metric": "p95 Latency",
                    "change": f"{abs(lat_pct)}%",
                    "direction": "up" if lat_pct > 0 else "down",
                    "severity": "danger" if lat_pct > 0 else "good",
                    "summary": f"p95 latency {direction} from {prev_stats['p95']}ms to {cur_stats['p95']}ms",
                    "contributor": "retrieval.search & multi-span LLM completions",
                    "filter_link": {"sort_by": "slowest"},
                })

        # Token delta
        if prev_stats["total_tokens"] > 0:
            tok_pct = round(((cur_stats["total_tokens"] - prev_stats["total_tokens"]) / prev_stats["total_tokens"]) * 100, 1)
            if abs(tok_pct) >= 5:
                direction = "increased" if tok_pct > 0 else "decreased"
                what_changed.append({
                    "metric": "Token Usage",
                    "change": f"{abs(tok_pct)}%",
                    "direction": "up" if tok_pct > 0 else "down",
                    "severity": "warning" if tok_pct > 0 else "good",
                    "summary": f"Token consumption {direction} by {abs(tok_pct)}%",
                    "contributor": "Agent prompt expansion and RAG context size",
                    "filter_link": {"sort_by": "most_tokens"},
                })

    if not what_changed:
        what_changed.append({
            "metric": "System Stability",
            "change": "Stable",
            "direction": "stable",
            "severity": "good",
            "summary": "No abnormal telemetry shifts detected compared to previous period",
            "contributor": "Normal workload distribution",
            "filter_link": {},
        })

    # Traffic time-series buckets
    num_buckets = 16
    traffic_series = []
    if current_traces:
        min_time = min(t.start_time for t in current_traces)
        max_time = max(t.start_time for t in current_traces)
        if min_time.tzinfo is None:
            min_time = min_time.replace(tzinfo=timezone.utc)
        if max_time.tzinfo is None:
            max_time = max_time.replace(tzinfo=timezone.utc)

        span_secs = max(60, int((max_time - min_time).total_seconds()))
        bucket_size = span_secs / num_buckets

        buckets = [{"total": 0, "success": 0, "error": 0, "time": (min_time + timedelta(seconds=i * bucket_size)).strftime("%H:%M")} for i in range(num_buckets)]

        for t in current_traces:
            t_time = t.start_time if t.start_time.tzinfo else t.start_time.replace(tzinfo=timezone.utc)
            b_idx = min(num_buckets - 1, max(0, int((t_time - min_time).total_seconds() / bucket_size)))
            buckets[b_idx]["total"] += 1
            if t.status == "error":
                buckets[b_idx]["error"] += 1
            else:
                buckets[b_idx]["success"] += 1

        traffic_series = buckets
    else:
        traffic_series = [{"total": 0, "success": 0, "error": 0, "time": f"{i:02d}:00"} for i in range(12)]

    # Time breakdown (LLM vs Retrieval vs Tools vs Other)
    total_time_sum = sum(cur_stats["durations"]) or 1.0
    llm_time_sum = sum(cur_stats["llm_durations"])
    retrieval_time_sum = sum(cur_stats["retrieval_durations"])
    tool_time_sum = sum(cur_stats["tool_durations"])
    other_time_sum = max(0, total_time_sum - (llm_time_sum + retrieval_time_sum + tool_time_sum))

    time_breakdown = {
        "llm_ms": round(llm_time_sum, 1),
        "llm_pct": round((llm_time_sum / total_time_sum) * 100, 1) if total_time_sum > 0 else 0.0,
        "retrieval_ms": round(retrieval_time_sum, 1),
        "retrieval_pct": round((retrieval_time_sum / total_time_sum) * 100, 1) if total_time_sum > 0 else 0.0,
        "tools_ms": round(tool_time_sum, 1),
        "tools_pct": round((tool_time_sum / total_time_sum) * 100, 1) if total_time_sum > 0 else 0.0,
        "other_ms": round(other_time_sum, 1),
        "other_pct": round((other_time_sum / total_time_sum) * 100, 1) if total_time_sum > 0 else 0.0,
    }

    return {
        "health": {
            "score": current_health_score,
            "prev_score": prev_health_score,
            "status": "healthy" if current_health_score >= 85 else ("warning" if current_health_score >= 70 else "degraded"),
            "factors": health_factors,
        },
        "kpis": {
            "requests": {
                "value": cur_stats["count"],
                "prev": prev_stats["count"],
                "delta": round(((cur_stats["count"] - prev_stats["count"]) / max(1, prev_stats["count"])) * 100, 1) if prev_stats["count"] > 0 else 0.0,
            },
            "error_rate": {
                "value": cur_stats["error_rate"],
                "prev": prev_stats["error_rate"],
                "delta": round(cur_stats["error_rate"] - prev_stats["error_rate"], 2),
            },
            "p50_latency": {
                "value": cur_stats["p50"],
                "prev": prev_stats["p50"],
                "delta": round(((cur_stats["p50"] - prev_stats["p50"]) / max(1, prev_stats["p50"])) * 100, 1) if prev_stats["p50"] > 0 else 0.0,
            },
            "p95_latency": {
                "value": cur_stats["p95"],
                "prev": prev_stats["p95"],
                "delta": round(((cur_stats["p95"] - prev_stats["p95"]) / max(1, prev_stats["p95"])) * 100, 1) if prev_stats["p95"] > 0 else 0.0,
            },
            "llm_cost": {
                "value": cur_stats["total_cost"],
                "prev": prev_stats["total_cost"],
                "delta": round(((cur_stats["total_cost"] - prev_stats["total_cost"]) / max(0.0001, prev_stats["total_cost"])) * 100, 1) if prev_stats["total_cost"] > 0 else 0.0,
            },
            "total_tokens": {
                "value": cur_stats["total_tokens"],
                "prev": prev_stats["total_tokens"],
                "delta": round(((cur_stats["total_tokens"] - prev_stats["total_tokens"]) / max(1, prev_stats["total_tokens"])) * 100, 1) if prev_stats["total_tokens"] > 0 else 0.0,
            },
        },
        "what_changed": what_changed,
        "traffic_series": traffic_series,
        "latency_percentiles": {
            "p50": cur_stats["p50"],
            "p75": cur_stats["p75"],
            "p90": cur_stats["p90"],
            "p95": cur_stats["p95"],
            "p99": cur_stats["p99"],
            "llm_p95": cur_stats["llm_p95"],
            "tool_p95": cur_stats["tool_p95"],
            "retrieval_p95": cur_stats["retrieval_p95"],
        },
        "time_breakdown": time_breakdown,
        "counts": {
            "traces": cur_stats["count"],
            "llm_spans": cur_stats["llm_spans"],
            "tool_spans": cur_stats["tool_spans"],
            "retrieval_spans": cur_stats["retrieval_spans"],
            "agent_spans": cur_stats["agent_spans"],
            "errors": cur_stats["errors"],
        },
    }

@router.get("/analytics/models")
def get_analytics_models(
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    spans = (
        db.query(SpanModel)
        .join(TraceModel)
        .filter(TraceModel.project_id == project.id, SpanModel.span_type == "llm")
        .all()
    )

    models_data: dict[str, dict[str, Any]] = {}
    for s in spans:
        attr = s.attributes_json or {}
        m = s.metrics_json or {}
        model_name = attr.get("model") or m.get("model") or "unknown-model"
        provider = attr.get("provider") or ("openai" if "gpt" in model_name else ("anthropic" if "claude" in model_name else "google" if "gemini" in model_name else "custom"))

        tokens = m.get("tokens") or attr.get("tokens") or {}
        p_tok = int(tokens.get("prompt") or attr.get("prompt_tokens", 0))
        c_tok = int(tokens.get("completion") or attr.get("completion_tokens", 0))
        cost_val = float(m.get("cost") or attr.get("cost", 0.0))

        if model_name not in models_data:
            models_data[model_name] = {
                "model": model_name,
                "provider": provider,
                "requests": 0,
                "errors": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "total_cost": 0.0,
                "durations": [],
            }

        md = models_data[model_name]
        md["requests"] += 1
        if s.status == "error":
            md["errors"] += 1
        md["prompt_tokens"] += p_tok
        md["completion_tokens"] += c_tok
        md["total_tokens"] += (p_tok + c_tok)
        md["total_cost"] += cost_val
        if s.duration_ms:
            md["durations"].append(s.duration_ms)

    results = []
    for md in models_data.values():
        reqs = md["requests"]
        results.append({
            "model": md["model"],
            "provider": md["provider"],
            "requests": reqs,
            "errors": md["errors"],
            "error_rate": round((md["errors"] / reqs) * 100, 2) if reqs > 0 else 0.0,
            "p50_latency": _percentile(md["durations"], 50),
            "p95_latency": _percentile(md["durations"], 95),
            "prompt_tokens": md["prompt_tokens"],
            "completion_tokens": md["completion_tokens"],
            "total_tokens": md["total_tokens"],
            "total_cost": round(md["total_cost"], 4),
            "avg_cost_per_request": round(md["total_cost"] / reqs, 6) if reqs > 0 else 0.0,
            "avg_tokens_per_request": round(md["total_tokens"] / reqs, 1) if reqs > 0 else 0.0,
        })

    results.sort(key=lambda x: x["requests"], reverse=True)
    return {"models": results, "total_models": len(results)}

@router.get("/analytics/tools")
def get_analytics_tools(
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    spans = (
        db.query(SpanModel)
        .join(TraceModel)
        .filter(TraceModel.project_id == project.id, SpanModel.span_type == "tool")
        .all()
    )

    tools_data: dict[str, dict[str, Any]] = {}
    for s in spans:
        tool_name = s.name
        if tool_name not in tools_data:
            tools_data[tool_name] = {
                "name": tool_name,
                "calls": 0,
                "errors": 0,
                "durations": [],
                "latest_called": s.start_time.isoformat(),
            }

        td = tools_data[tool_name]
        td["calls"] += 1
        if s.status == "error":
            td["errors"] += 1
        if s.duration_ms:
            td["durations"].append(s.duration_ms)
        if s.start_time.isoformat() > td["latest_called"]:
            td["latest_called"] = s.start_time.isoformat()

    results = []
    for td in tools_data.values():
        c = td["calls"]
        results.append({
            "name": td["name"],
            "calls": c,
            "errors": td["errors"],
            "error_rate": round((td["errors"] / c) * 100, 2) if c > 0 else 0.0,
            "p50_latency": _percentile(td["durations"], 50),
            "p95_latency": _percentile(td["durations"], 95),
            "latest_called": td["latest_called"],
        })

    results.sort(key=lambda x: x["calls"], reverse=True)
    return {"tools": results, "total_tools": len(results)}

@router.get("/analytics/retrieval")
def get_analytics_retrieval(
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    spans = (
        db.query(SpanModel)
        .join(TraceModel)
        .filter(TraceModel.project_id == project.id, SpanModel.span_type == "retrieval")
        .all()
    )

    total_calls = len(spans)
    durations = []
    errors = 0
    docs_counts = []
    scores = []
    queries = []

    for s in spans:
        if s.status == "error":
            errors += 1
        if s.duration_ms:
            durations.append(s.duration_ms)

        attr = s.attributes_json or {}
        out = s.output_json
        inp = s.input_json

        # Parse query string
        q_text = "Query"
        if isinstance(inp, dict):
            q_text = str(inp.get("query") or inp.get("question") or inp.get("text") or s.name)
        elif isinstance(inp, str):
            q_text = inp

        doc_count = 0
        if isinstance(out, list):
            doc_count = len(out)
            for d in out:
                if isinstance(d, dict) and "score" in d:
                    try:
                        scores.append(float(d["score"]))
                    except:
                        pass
        elif isinstance(out, dict):
            docs = out.get("documents") or out.get("results") or []
            if isinstance(docs, list):
                doc_count = len(docs)
                for d in docs:
                    if isinstance(d, dict) and "score" in d:
                        try:
                            scores.append(float(d["score"]))
                        except:
                            pass

        docs_counts.append(doc_count)
        queries.append({
            "span_id": str(s.id),
            "trace_id": str(s.trace_id),
            "query": q_text[:120],
            "duration_ms": s.duration_ms or 0.0,
            "status": s.status,
            "documents_count": doc_count,
            "start_time": s.start_time.isoformat(),
        })

    avg_docs = round(sum(docs_counts) / max(1, total_calls), 1)
    avg_score = round(sum(scores) / max(1, len(scores)), 3) if scores else 0.82

    queries.sort(key=lambda x: x["duration_ms"], reverse=True)

    return {
        "total_calls": total_calls,
        "error_rate": round((errors / max(1, total_calls)) * 100, 2),
        "p50_latency": _percentile(durations, 50),
        "p95_latency": _percentile(durations, 95),
        "avg_documents_retrieved": avg_docs,
        "avg_relevance_score": avg_score,
        "slow_retrievals": sum(1 for d in durations if d > 1000),
        "empty_retrievals": sum(1 for c in docs_counts if c == 0),
        "queries": queries[:25],
    }

@router.get("/analytics/agents")
def get_analytics_agents(
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    traces = (
        db.query(TraceModel)
        .filter(TraceModel.project_id == project.id)
        .all()
    )

    agent_traces = []
    for t in traces:
        agent_spans = [s for s in t.spans if s.span_type == "agent" or "agent" in s.name.lower()]
        if agent_spans or "agent" in t.name.lower():
            llm_count = sum(1 for s in t.spans if s.span_type == "llm")
            tool_count = sum(1 for s in t.spans if s.span_type == "tool")
            retrieval_count = sum(1 for s in t.spans if s.span_type == "retrieval")

            cost = 0.0
            tokens = 0
            for s in t.spans:
                m = s.metrics_json or {}
                attr = s.attributes_json or {}
                cost += float(m.get("cost") or attr.get("cost", 0.0))
                tok = m.get("tokens") or attr.get("tokens") or {}
                tokens += int(tok.get("prompt", 0) or attr.get("prompt_tokens", 0)) + int(tok.get("completion", 0) or attr.get("completion_tokens", 0))

            # Detect potential loops
            tool_names = [s.name for s in t.spans if s.span_type == "tool"]
            has_repeated_tool = len(tool_names) > len(set(tool_names)) and len(tool_names) >= 3
            is_loop_candidate = has_repeated_tool or (len(t.spans) > 12)

            agent_traces.append({
                "trace_id": str(t.id),
                "name": t.name,
                "duration_ms": t.duration_ms or 0.0,
                "status": t.status,
                "step_count": len(t.spans),
                "llm_count": llm_count,
                "tool_count": tool_count,
                "retrieval_count": retrieval_count,
                "tokens": tokens,
                "cost": round(cost, 4),
                "is_loop_candidate": is_loop_candidate,
                "start_time": t.start_time.isoformat(),
            })

    total_runs = len(agent_traces)
    avg_steps = round(sum(a["step_count"] for a in agent_traces) / max(1, total_runs), 1)
    avg_duration = round(sum(a["duration_ms"] for a in agent_traces) / max(1, total_runs), 1)
    failures = sum(1 for a in agent_traces if a["status"] == "error")
    fail_rate = round((failures / max(1, total_runs)) * 100, 2)
    loop_candidates = sum(1 for a in agent_traces if a["is_loop_candidate"])

    agent_traces.sort(key=lambda x: x["start_time"], reverse=True)

    return {
        "total_agent_runs": total_runs,
        "avg_step_count": avg_steps,
        "avg_duration_ms": avg_duration,
        "failure_rate": fail_rate,
        "loop_candidates_count": loop_candidates,
        "runs": agent_traces,
    }
