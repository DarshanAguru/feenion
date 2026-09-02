from fastapi.testclient import TestClient
from feenion_server.main import app

client = TestClient(app)

def test_admin_clear_requires_confirmation():
    res = client.post("/api/v1/admin/traces/purge", json={"confirmation": "wrong text"})
    assert res.status_code == 400
    assert "Confirmation text mismatch" in res.json()["detail"]

def test_admin_clear_success():
    res = client.post(
        "/api/v1/admin/traces/purge",
        json={"confirmation": "delete everything"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

def test_admin_batch_delete():
    res = client.post(
        "/api/v1/admin/traces/batch-delete",
        json={
            "trace_ids": ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"],
            "confirmation": "delete selected",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

def test_admin_batch_delete_wrong_confirmation():
    res = client.post(
        "/api/v1/admin/traces/batch-delete",
        json={
            "trace_ids": ["00000000-0000-0000-0000-000000000001"],
            "confirmation": "wrong text",
        },
    )
    assert res.status_code == 400

def test_admin_clear_workspace_isolation():
    from feenion_server.db import SessionLocal
    from feenion_server.worker import worker

    # Ingest trace to workspace A
    client.post(
        "/api/v1/traces",
        headers={"X-Workspace-Id": "workspace-alpha"},
        json={
            "traces": [{
                "trace_id": "11111111-1111-1111-1111-111111111111",
                "name": "trace_alpha",
                "start_time": "2026-09-02T12:00:00Z",
                "status": "ok",
                "spans": [],
            }],
        },
    )

    # Ingest trace to workspace B
    client.post(
        "/api/v1/traces",
        headers={"X-Workspace-Id": "workspace-beta"},
        json={
            "traces": [{
                "trace_id": "22222222-2222-2222-2222-222222222222",
                "name": "trace_beta",
                "start_time": "2026-09-02T12:00:00Z",
                "status": "ok",
                "spans": [],
            }],
        },
    )

    # Flush queued batches to DB
    db = SessionLocal()
    while True:
        item = worker.queue.dequeue_batch(timeout=0.05)
        if not item:
            break
        proj_id, trs = item
        worker.process_batch(db, proj_id, trs)
    db.commit()
    db.close()

    # Purge workspace Alpha
    res = client.post(
        "/api/v1/admin/traces/purge",
        headers={"X-Workspace-Id": "workspace-alpha"},
        json={"confirmation": "delete everything"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Verify workspace Alpha is empty
    res_alpha = client.get("/api/v1/traces", headers={"X-Workspace-Id": "workspace-alpha"})
    assert res_alpha.status_code == 200
    assert len(res_alpha.json()["traces"]) == 0

    # Verify workspace Beta still retains its trace!
    res_beta = client.get("/api/v1/traces", headers={"X-Workspace-Id": "workspace-beta"})
    assert res_beta.status_code == 200
    assert len(res_beta.json()["traces"]) >= 1
    assert any(t["trace_id"] == "22222222-2222-2222-2222-222222222222" for t in res_beta.json()["traces"])
