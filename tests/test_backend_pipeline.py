import time
import pytest
from fastapi.testclient import TestClient
from feenion_server.main import app

def test_health_and_readiness():
    with TestClient(app) as client:
        res_health = client.get("/health")
        assert res_health.status_code == 200
        assert res_health.json()["status"] == "ok"

        res_ready = client.get("/ready")
        assert res_ready.status_code == 200
        assert res_ready.json()["status"] == "ready"

def test_ingestion_and_query_pipeline():
    with TestClient(app) as client:
        # 1. Post a trace batch to ingestion API
        batch_payload = {
            "schema_version": "1.0",
            "sdk_version": "0.1.0",
            "traces": [
                {
                    "trace_id": "00000000-0000-0000-0000-000000000001",
                    "name": "llm_agent_pipeline",
                    "start_time": "2026-08-30T10:00:00Z",
                    "end_time": "2026-08-30T10:00:02Z",
                    "duration_ms": 2000.0,
                    "status": "ok",
                    "metadata": {"user_id": "usr_123"},
                    "spans": [
                        {
                            "span_id": "00000000-0000-0000-0000-000000000002",
                            "trace_id": "00000000-0000-0000-0000-000000000001",
                            "parent_span_id": None,
                            "name": "gpt-4o_call",
                            "span_type": "llm",
                            "start_time": "2026-08-30T10:00:00.500Z",
                            "end_time": "2026-08-30T10:00:01.800Z",
                            "duration_ms": 1300.0,
                            "status": "ok",
                            "attributes": {"model": "gpt-4o"},
                            "input": {"prompt": "What is Feenion?"},
                            "output": {"text": "Feenion is an AI debugger."},
                            "metrics": {"tokens": {"prompt": 15, "completion": 25, "total": 40}, "cost": 0.002},
                            "events": [],
                        }
                    ],
                }
            ],
        }

        ingest_res = client.post("/api/v1/traces", json=batch_payload)
        assert ingest_res.status_code == 200
        assert ingest_res.json()["accepted"] == 1

        from feenion_server.db import SessionLocal
        from feenion_server.queue import trace_queue
        from feenion_server.worker import worker

        db = SessionLocal()
        item = trace_queue.dequeue_batch(timeout=0.1)
        if item:
            worker.process_batch(db, item[0], item[1])
            db.commit()
        db.close()

        query_res = client.get("/api/v1/traces")
        assert query_res.status_code == 200
        data = query_res.json()
        assert data["total"] >= 1

        found = [t for t in data["traces"] if t["trace_id"] == "00000000-0000-0000-0000-000000000001"]
        assert len(found) == 1
        tr = found[0]
        assert tr["name"] == "llm_agent_pipeline"
        assert tr["tokens"]["total"] == 40
        assert tr["estimated_cost"] == 0.002

        # 3. Query spans for trace
        spans_res = client.get("/api/v1/traces/00000000-0000-0000-0000-000000000001/spans")
        assert spans_res.status_code == 200
        spans_data = spans_res.json()
        assert len(spans_data) == 1
        assert spans_data[0]["name"] == "gpt-4o_call"

