import base64
from fastapi.testclient import TestClient
from feenion_server.main import app

client = TestClient(app)

def test_admin_clear_requires_auth():
    res = client.delete("/api/v1/admin/traces")
    assert res.status_code == 401

def test_admin_clear_wrong_creds():
    token = base64.b64encode(b"admin:wrongpassword").decode("utf-8")
    res = client.delete(
        "/api/v1/admin/traces",
        headers={"Authorization": f"Basic {token}"},
    )
    assert res.status_code == 401

def test_admin_clear_success():
    token = base64.b64encode(b"admin:admin").decode("utf-8")
    res = client.delete(
        "/api/v1/admin/traces",
        headers={"Authorization": f"Basic {token}"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

def test_admin_batch_delete():
    token = base64.b64encode(b"admin:admin").decode("utf-8")
    res = client.post(
        "/api/v1/admin/traces/batch-delete",
        json={"trace_ids": ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"]},
        headers={"Authorization": f"Basic {token}"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"
