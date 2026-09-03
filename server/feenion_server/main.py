from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from .api.admin import router as admin_router
from .api.ingestion import router as ingestion_router
from .api.query import router as query_router
from .config import settings
from .store import TraceStore
from .worker import worker
from .db import init_db
from .ws import manager

WEB_DIST_PATH = Path(__file__).resolve().parent.parent.parent / "web" / "dist"
WEB_INDEX_PATH = Path(__file__).resolve().parent.parent.parent / "web" / "index.html"

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    worker.start()
    yield
    worker.stop()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

trace_store = TraceStore()

app.include_router(ingestion_router)
app.include_router(query_router)
app.include_router(admin_router)

# Serve React static assets if built into web/dist
if (WEB_DIST_PATH / "assets").exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIST_PATH / "assets"), name="assets")

@app.websocket("/api/v1/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/favicon.svg")
@app.get("/favicon.ico")
def serve_favicon():
    if (WEB_DIST_PATH / "favicon.svg").exists():
        return FileResponse(WEB_DIST_PATH / "favicon.svg", media_type="image/svg+xml")
    pub_fav = Path(__file__).resolve().parent.parent.parent / "web" / "public" / "favicon.svg"
    if pub_fav.exists():
        return FileResponse(pub_fav, media_type="image/svg+xml")
    site_fav = Path(__file__).resolve().parent.parent.parent / "site" / "assets" / "favicon.svg"
    if site_fav.exists():
        return FileResponse(site_fav, media_type="image/svg+xml")
    return HTMLResponse("", status_code=404)

@app.get("/", response_class=HTMLResponse)
@app.get("/ui", response_class=HTMLResponse)
def serve_ui():
    if (WEB_DIST_PATH / "index.html").exists():
        return FileResponse(WEB_DIST_PATH / "index.html")
    if WEB_INDEX_PATH.exists():
        return FileResponse(WEB_INDEX_PATH)
    return HTMLResponse("<h1>Feenion Server API</h1><p>Visit /api/v1/traces to query ingested data.</p>")

@app.get("/health")
def health():
    return {"status": "ok", "version": settings.app_version}

@app.get("/ready")
def readiness():
    return {
        "status": "ready",
        "database": "connected",
        "queue": "active" if worker._thread and worker._thread.is_alive() else "degraded",
    }

@app.get("/api/v1/count/traces")
def trace_count():
    return {"count": trace_store.count()}

def start():
    uvicorn.run(
        "feenion_server.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )

if __name__ == "__main__":
    start()