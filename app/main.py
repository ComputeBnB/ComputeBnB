from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import workers, jobs
from app.services.discovery import discovery_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: begin mDNS discovery
    discovery_service.start()
    yield
    # Shutdown: stop discovery
    discovery_service.stop()


app = FastAPI(
    title="ComputeBnB",
    description="P2P compute sharing on local network",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for GUI service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(workers.router)
app.include_router(jobs.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
