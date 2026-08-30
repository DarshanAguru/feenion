from fastapi.testclient import TestClient
from feenion_server.main import app

def test_health():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

def test_empty_batch_rejected():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/traces",
            json={"traces": []},
        )
        assert response.status_code == 400