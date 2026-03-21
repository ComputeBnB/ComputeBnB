from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.routers import host, jobs, workers
from app.services.discovery import discovery_service
from app.services.host_service import host_service

ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
INDEX_FILE = DIST_DIR / "index.html"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    discovery_service.start()
    try:
        yield
    finally:
        if host_service.get_state().running:
            await host_service.stop()
        discovery_service.stop()


app = FastAPI(
    title="ComputeBnB",
    description="LAN compute sharing MVP",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workers.router)
app.include_router(jobs.router)
app.include_router(host.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
async def serve_root():
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    return JSONResponse(
        status_code=200,
        content={
            "message": "Frontend not built yet. Run `npm run build` or use `npm run dev` during development.",
        },
    )


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    reserved_prefixes = ("api/", "jobs/", "workers/", "docs", "redoc", "openapi.json")
    if full_path == "health" or full_path.startswith(reserved_prefixes):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    asset_path = DIST_DIR / full_path
    if asset_path.exists() and asset_path.is_file():
        return FileResponse(asset_path)
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    return JSONResponse(status_code=404, content={"detail": "Frontend not available"})
