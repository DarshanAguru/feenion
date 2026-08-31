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
