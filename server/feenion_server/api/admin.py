from __future__ import annotations

import secrets
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import EventModel, SpanModel, TraceModel, get_db
from ..store import TraceStore
from ..ws import manager

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
)

security = HTTPBasic()
trace_store = TraceStore()

def verify_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    correct_username = secrets.compare_digest(credentials.username, "admin")
    correct_password = secrets.compare_digest(credentials.password, "admin")
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials (expected admin:admin)",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

class BatchDeleteRequest(BaseModel):
    trace_ids: list[str]

@router.delete("/traces")
async def clear_all_traces(
    db: Session = Depends(get_db),
    admin_user: str = Depends(verify_admin),
):
    """Purge all traces, spans, and events from the database."""
    db.query(EventModel).delete()
    db.query(SpanModel).delete()
    db.query(TraceModel).delete()
    db.commit()

    # Clear in-memory cache
    trace_store.clear()

    # Broadcast instant WebSocket refresh to connected dashboards
    await manager.broadcast({
        "type": "data_cleared",
        "message": "All traces purged by admin",
    })

    return {
        "status": "success",
        "message": "All telemetry traces, spans, and events have been purged.",
        "admin": admin_user,
    }

@router.post("/traces/batch-delete")
async def batch_delete_traces(
    body: BatchDeleteRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(verify_admin),
):
    """Delete multiple selected traces and their spans and events in a single operation."""
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
        "admin": admin_user,
    }

@router.delete("/traces/{trace_id}")
async def delete_single_trace(
    trace_id: UUID,
    db: Session = Depends(get_db),
    admin_user: str = Depends(verify_admin),
):
    """Delete a single trace and its associated spans and events."""
    str_id = str(trace_id)
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
        "admin": admin_user,
    }
