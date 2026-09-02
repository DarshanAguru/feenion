from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_project
from ..db import EventModel, SpanModel, TraceModel, Project, get_db
from ..store import TraceStore
from ..ws import manager

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
)

trace_store = TraceStore()

class PurgeAllRequest(BaseModel):
    confirmation: Optional[str] = None

class BatchDeleteRequest(BaseModel):
    trace_ids: list[str]
    confirmation: Optional[str] = None

@router.delete("/traces")
@router.post("/traces/purge")
async def clear_all_traces(
    body: Optional[PurgeAllRequest] = None,
    confirmation: Optional[str] = None,
    db: Session = Depends(get_db),
    project: Project = Depends(get_current_project),
):
    """Purge all traces, spans, and events for the active workspace with 'delete everything' confirmation."""
    conf = (body.confirmation if body and body.confirmation else None) or confirmation
    if not conf or conf.strip().lower() != "delete everything":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation text mismatch. You must enter 'delete everything' to purge data.",
        )

    # Find all trace IDs belonging specifically to the active workspace
    workspace_trace_ids = [t[0] for t in db.query(TraceModel.id).filter(TraceModel.project_id == project.id).all()]

    if workspace_trace_ids:
        db.query(EventModel).filter(EventModel.trace_id.in_(workspace_trace_ids)).delete(synchronize_session=False)
        db.query(SpanModel).filter(SpanModel.trace_id.in_(workspace_trace_ids)).delete(synchronize_session=False)
        db.query(TraceModel).filter(TraceModel.id.in_(workspace_trace_ids)).delete(synchronize_session=False)
        db.commit()

    # Clear in-memory cache for this workspace's traces
    trace_store.remove_traces(workspace_trace_ids)

    # Broadcast instant WebSocket refresh to connected dashboards
    await manager.broadcast({
        "type": "data_cleared",
        "workspace_id": str(project.id),
        "workspace_name": project.name,
        "message": f"All traces purged for workspace '{project.name}'",
    })

    return {
        "status": "success",
        "workspace_id": str(project.id),
        "workspace_name": project.name,
        "deleted_count": len(workspace_trace_ids),
        "message": f"All telemetry traces, spans, and events have been purged for workspace '{project.name}'.",
    }

@router.post("/traces/batch-delete")
async def batch_delete_traces(
    body: BatchDeleteRequest,
    db: Session = Depends(get_db),
):
    """Delete multiple selected traces and their spans and events with 'delete selected' confirmation."""
    if body.confirmation and body.confirmation.strip().lower() != "delete selected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation text mismatch. You must enter 'delete selected' to delete selected traces.",
        )

    ids = [str(t_id).strip() for t_id in body.trace_ids if str(t_id).strip()]
    if not ids:
        return {"status": "success", "deleted_count": 0, "message": "No trace IDs provided"}

    db.query(EventModel).filter(EventModel.trace_id.in_(ids)).delete(synchronize_session=False)
    db.query(SpanModel).filter(SpanModel.trace_id.in_(ids)).delete(synchronize_session=False)
    db.query(TraceModel).filter(TraceModel.id.in_(ids)).delete(synchronize_session=False)
    db.commit()

    await manager.broadcast({
        "type": "traces_batch_deleted",
        "trace_ids": ids,
    })

    return {
        "status": "success",
        "deleted_count": len(ids),
        "message": f"Successfully deleted {len(ids)} traces.",
    }

@router.delete("/traces/{trace_id}")
async def delete_single_trace(
    trace_id: str,
    db: Session = Depends(get_db),
):
    """Delete a single trace and its associated spans and events."""
    str_id = str(trace_id).strip()
    trace = db.query(TraceModel).filter(TraceModel.id == str_id).first()
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")

    db.query(EventModel).filter(EventModel.trace_id == str_id).delete()
    db.query(SpanModel).filter(SpanModel.trace_id == str_id).delete()
    db.query(TraceModel).filter(TraceModel.id == str_id).delete()
    db.commit()

    await manager.broadcast({
        "type": "trace_deleted",
        "trace_id": str_id,
    })

    return {
        "status": "success",
        "message": f"Trace {str_id} deleted.",
    }
