# ComputeBnb

ComputeBnb is a LAN-only hackathon MVP for sending a single-file Python job from a `guest` machine to a `host` machine, running it in Docker, and streaming live output back to the guest UI.

The repo now contains both:

- a Python FastAPI control plane for discovery, host mode, TCP bridging, and execution
- the React UI originally built on the `gui` branch, now wired to the live backend

## What Works

- mDNS host discovery over the local network
- manual IP + port fallback when discovery does not show a host
- one-click host mode from the UI
- host-side accept or deny flow before a job starts
- TCP job transport using newline-delimited JSON
- Docker-first Python execution with `python:3.11-slim`
- subprocess fallback in trusted-demo mode when Docker is unavailable
- live stdout and stderr streaming in the UI
- timeout enforcement and cleanup
- final result screen with runtime, backend, logs, and output file list
- automatic TCP connection close after the final result

## Repo Layout

```text
app/
  main.py                 FastAPI app and SPA serving
  routers/                API + WebSocket routes
  services/               discovery, host server, TCP client, execution runtime
src/                      React UI ported from the gui branch
src-tauri/                Original Tauri shell from the gui branch
tests/                    Python smoke tests for runtime and TCP roundtrip
worker/test_worker.py     Standalone host launcher for local smoke testing
```

## Runtime Notes

- Recommended local interpreter: Python 3.11
- Current package metadata allows Python 3.9+ so the app can still run in more dev environments
- Remote job execution still targets Docker image `python:3.11-slim`

## Quick Start

### Option 1: one command

```bash
./run.sh
```

This will:

- create `.venv` if needed
- install Python dependencies
- install frontend dependencies if needed
- build the React UI
- start FastAPI on `http://localhost:8000`

### Option 2: split backend + frontend for development

Backend:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install .[dev]
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` and WebSocket traffic to `http://127.0.0.1:8000`.

## Demo Flow

### Guest machine

1. Open the app
2. Wait for discovered hosts or enter a manual IP and port
3. Select a host
4. Paste Python code, set a timeout, and request execution
5. Watch the approval state, live logs, and final result
6. Return to the host list after completion

### Host machine

1. Open the app
2. Click `Host This Computer`
3. Wait for a guest request
4. Accept or deny the pending job
5. After completion, the host returns to its idle screen and the TCP session closes

## Protocol

Transport is newline-delimited JSON over TCP.

Guest to host:

```json
{ "type": "run", "job_id": "job-1", "job_name": "Quick Python Job", "filename": "main.py", "timeout_secs": 120, "guest_name": "My Laptop", "code": "print('hi')" }
```

```json
{ "type": "cancel", "job_id": "job-1" }
```

Host to guest examples:

```json
{ "type": "status", "job_id": "job-1", "state": "awaiting_accept", "message": "Waiting for the host to accept this job." }
```

```json
{ "type": "stdout", "job_id": "job-1", "data": "hello\n" }
```

```json
{ "type": "stderr", "job_id": "job-1", "data": "Docker unavailable; running in trusted-demo subprocess mode.\n" }
```

```json
{ "type": "metrics", "job_id": "job-1", "cpu_pct": 0, "mem_mb": 0, "elapsed_secs": 2.1 }
```

```json
{ "type": "done", "job_id": "job-1", "state": "done", "exit_code": 0, "duration_ms": 820, "backend": "docker", "artifacts": [], "summary": "Finished successfully on docker with no output files produced." }
```

```json
{ "type": "error", "job_id": "job-1", "message": "The host declined the job or did not respond in time." }
```

## Docker Fallback Behavior

ComputeBnb tries Docker first.

If Docker is not installed or not running on the host, the job runs locally with the host Python interpreter and the UI labels that path as trusted-demo mode.

You can force fallback mode in development with:

```bash
export COMPUTEBNB_DISABLE_DOCKER=1
```

## Standalone Host Smoke Test

If you want to advertise a host without opening the UI:

```bash
source .venv/bin/activate
python worker/test_worker.py
```

That script starts mDNS advertisement and the TCP host listener directly.

## Tests

```bash
source .venv/bin/activate
pytest
```

Current smoke coverage includes:

- subprocess fallback execution and output collection
- TCP roundtrip through the host accept flow

## Known MVP Limits

- one active job per host
- single-file Python only
- output files are listed in the guest UI but not yet downloaded back to the guest
- Tauri shell files are still present from the original `gui` branch, but the primary supported flow is the FastAPI + React app
- sandboxing is still hackathon-grade only
