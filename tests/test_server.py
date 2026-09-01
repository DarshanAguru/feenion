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

def test_analytics_endpoints():
    with TestClient(app) as client:
        # 1. Overview analytics
        res_overview = client.get("/api/v1/analytics/overview")
        assert res_overview.status_code == 200
        data_overview = res_overview.json()
        assert "health" in data_overview
        assert "kpis" in data_overview
        assert "what_changed" in data_overview
        assert "traffic_series" in data_overview

        # 2. Models analytics
        res_models = client.get("/api/v1/analytics/models")
        assert res_models.status_code == 200
        assert "models" in res_models.json()

        # 3. Tools analytics
        res_tools = client.get("/api/v1/analytics/tools")
        assert res_tools.status_code == 200
        assert "tools" in res_tools.json()

        # 4. Retrieval analytics
        res_retrieval = client.get("/api/v1/analytics/retrieval")
        assert res_retrieval.status_code == 200
        assert "total_calls" in res_retrieval.json()

        # 5. Agents analytics
        res_agents = client.get("/api/v1/analytics/agents")
        assert res_agents.status_code == 200
        assert "total_agent_runs" in res_agents.json()

import uuid

def test_project_lifecycle_and_filters():
    with TestClient(app) as client:
        unique_name = f"test-workspace-{uuid.uuid4().hex[:8]}"
        # Create project with JSON body
        proj_res = client.post("/api/v1/projects", json={"name": unique_name})
        assert proj_res.status_code == 200
        proj_data = proj_res.json()
        assert proj_data["project"]["name"] == unique_name
        assert "api_key" in proj_data
        proj_id = proj_data["project"]["id"]

        # List projects
        list_res = client.get("/api/v1/projects")
        assert list_res.status_code == 200
        assert any(p["name"] == unique_name for p in list_res.json())

        # List traces with project header, time_window, env, and search
        traces_res = client.get(
            "/api/v1/traces",
            headers={"X-Project-Id": proj_id},
            params={"time_window": "24h", "environment": "production", "search": "test"},
        )
        assert traces_res.status_code == 200
        assert "traces" in traces_res.json()

        # Ingest trace into this project using API Key
        trace_id = str(uuid.uuid4())
        ingest_res = client.post(
            "/api/v1/traces",
            headers={"X-Feenion-Api-Key": proj_data["api_key"]},
            json={
                "schema_version": "1.0",
                "traces": [
                    {
                        "trace_id": trace_id,
                        "name": "isolated_workspace_task",
                        "start_time": "2026-09-01T12:00:00Z",
                        "status": "ok",
                        "spans": [],
                    }
                ],
            },
        )
        assert ingest_res.status_code == 200
        assert ingest_res.json()["accepted"] == 1

        # Delete project
        del_res = client.delete(f"/api/v1/projects/{proj_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Verify project is gone
        list_after = client.get("/api/v1/projects")
        assert not any(p["id"] == proj_id for p in list_after.json())