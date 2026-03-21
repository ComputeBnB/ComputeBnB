#!/usr/bin/env python3
"""
ComputeBnB CLI - Cross-platform (Windows/Unix) command-line interface for guest/host operations.

Usage:
  python cli.py host   # Run as host (advertise, accept jobs)
  python cli.py guest  # Run as guest (discover hosts, send job)
"""
import sys
import asyncio
import platform
import os

BACKEND_ROOT = os.path.dirname(__file__)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app
from app.services.discovery import discovery_service
from app.services.hosting import FASTAPI_PORT, hosting_service


def _host_snapshot(hosts):
    return [
        (host.worker_id, host.display_name, host.host, host.port, host.status.value)
        for host in sorted(hosts, key=lambda item: (item.display_name, item.host, item.port))
    ]


def _print_hosts(hosts):
    print("[Guest] Found hosts:")
    for idx, host in enumerate(hosts):
        print(f"  [{idx}] {host.display_name} ({host.host}:{host.port}) - {host.status.value}")

async def run_host():
    uvicorn = __import__("uvicorn")

    print(f"[Host] Starting API server on port {FASTAPI_PORT}...")
    server = uvicorn.Server(
        uvicorn.Config(app, host="0.0.0.0", port=FASTAPI_PORT, log_level="warning")
    )
    server_task = asyncio.create_task(server.serve())

    while not server.started:
        if server_task.done():
            server_task.result()
        await asyncio.sleep(0.1)

    print("[Host] Starting hosting service...")
    result = await hosting_service.start_hosting()
    print(f"[Host] Advertised as: {result}")
    print("[Host] Waiting for job requests. Press Ctrl+C to stop.")
    try:
        while True:
            await asyncio.sleep(5)
            pending = hosting_service.get_all_pending()
            if pending:
                print(f"[Host] Pending requests: {[r.request_id for r in pending]}")
                for req in pending:
                    print(f"Approving request {req.request_id} from {req.guest_name} ({req.guest_ip})...")
                    hosting_service.approve_request(req.request_id)
    except KeyboardInterrupt:
        pass
    finally:
        print("[Host] Stopping hosting service...")
        await hosting_service.stop_hosting()
        server.should_exit = True
        await server_task
        print("[Host] Stopped.")

async def run_guest():
    print("[Guest] Discovering hosts...")
    discovery_service.start()
    try:
        hosts = []
        last_snapshot = None
        stable_polls = 0

        while True:
            hosts = list(discovery_service.get_workers().values())
            snapshot = _host_snapshot(hosts)

            if snapshot != last_snapshot:
                stable_polls = 0
                if hosts:
                    _print_hosts(hosts)
                else:
                    print("[Guest] No hosts found yet. Waiting for advertisements...")
                last_snapshot = snapshot
            else:
                stable_polls += 1

            if hosts and stable_polls >= 2:
                break

            await asyncio.sleep(1)
    finally:
        discovery_service.stop()

    if not hosts:
        print("[Guest] No hosts found.")
        return

    choice = input("Select host to send job to (number) or enter -1 to poll again: ")
    try:
        idx = int(choice)
        if idx == -1:
            print("[Guest] Polling for hosts again...")
            return await run_guest()
        host = hosts[idx]
    except (ValueError, IndexError):
        print("Invalid selection.")
        return

    import requests
    import zipfile
    import tempfile

    folder_path = input("Enter path to folder to zip and run on host: ").strip()
    if not os.path.isdir(folder_path):
        print(f"Folder not found: {folder_path}")
        return

    # Zip the folder to a temp file
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp_zip:
        with zipfile.ZipFile(tmp_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(folder_path):
                for file in files:
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, folder_path)
                    zipf.write(abs_path, rel_path)
        zip_path = tmp_zip.name

    url = f"http://{host.host}:{host.port}/jobs/request"
    print(f"[Guest] Sending zip to {url}...")
    with open(zip_path, "rb") as f:
        files = {"file": (os.path.basename(zip_path), f, "application/zip")}
        data = {"guest_name": platform.node(), "timeout_secs": 300}
        try:
            resp = requests.post(url, files=files, data=data)
        except requests.RequestException as exc:
                print(f"[Guest] Failed to reach host API at {url}: {exc}")
                print("[Guest] Make sure the host is running in host mode and the FastAPI server is listening on the advertised port.")
                return
        
    
    print(f"[Guest] Response: {resp.json()}" if resp.headers.get('content-type','').startswith('application/json') else resp.text)

if __name__ == "__main__":
    print("Select mode:")
    print("  1. Host (advertise, accept jobs)")
    print("  2. Guest (discover hosts, send job)")
    mode = input("Enter choice [1/2]: ").strip()
    if mode == "2":
        asyncio.run(run_guest())
    else:
        asyncio.run(run_host())
