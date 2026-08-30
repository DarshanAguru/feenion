from __future__ import annotations

import asyncio
import gzip
import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError

from ..models import TraceBatch
from ..store import TraceStore
from ..config import settings
from ..ws import manager

router = APIRouter(
    prefix="/api/v1",
    tags=["ingestion"],
)

def get_store() -> TraceStore:
    from ..main import trace_store
    return trace_store

@router.post("/traces")
async def ingest_traces(request: Request, store: TraceStore = Depends(get_store)):
    body = await request.body()
    if request.headers.get("content-encoding") == "gzip":
        try:
            body = gzip.decompress(body)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid gzip compression: {e}")

    try:
        data = json.loads(body)
        batch = TraceBatch.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid trace batch payload: {e}")

    if not batch.traces:
        raise HTTPException(status_code=400, detail="Trace batch cannot be empty")

    if len(batch.traces) > settings.max_batch_size:
        raise HTTPException(
            status_code=413,
            detail=f"Maximum batch size is {settings.max_batch_size}",
        )

    store.add_many(batch.traces)

    # Immediately broadcast instant real-time telemetry push to connected WebSockets
    asyncio.create_task(manager.broadcast({
        "type": "trace_ingested",
        "count": len(batch.traces),
    }))

    return {
        "accepted": len(batch.traces),
        "schema_version": batch.schema_version,
    }

@router.get("/traces/{trace_id}")
def get_trace(trace_id: UUID, store: TraceStore = Depends(get_store)):
    trace = store.get(trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace