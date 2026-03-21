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
import importlib.util

BACKEND_PATH = os.path.join(os.path.dirname(__file__), "app")

# Import backend modules dynamically
def import_backend_module(module_path, module_name):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module {module_name} from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

# Import hosting and discovery services
HOSTING_PATH = os.path.join(BACKEND_PATH, "services", "hosting.py")
DISCOVERY_PATH = os.path.join(BACKEND_PATH, "services", "discovery.py")
hosting_mod = import_backend_module(HOSTING_PATH, "hosting")
discovery_mod = import_backend_module(DISCOVERY_PATH, "discovery")


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
    print("[Host] Starting hosting service...")
    result = await hosting_mod.hosting_service.start_hosting()
    print(f"[Host] Advertised as: {result}")
    print("[Host] Waiting for job requests. Press Ctrl+C to stop.")
    try:
        while True:
            await asyncio.sleep(5)
            pending = hosting_mod.hosting_service.get_all_pending()
            if pending:
                print(f"[Host] Pending requests: {[r.request_id for r in pending]}")
                for req in pending:
                    print(f"Approving request {req.request_id} from {req.guest_name} ({req.guest_ip})...")
                    hosting_mod.hosting_service.approve_request(req.request_id)
    except KeyboardInterrupt:
        print("[Host] Stopping hosting service...")
        await hosting_mod.hosting_service.stop_hosting()
        print("[Host] Stopped.")

async def run_guest():
    print("[Guest] Discovering hosts...")
    discovery_mod.discovery_service.start()
    try:
        hosts = []
        last_snapshot = None
        stable_polls = 0

        while True:
            hosts = list(discovery_mod.discovery_service.get_workers().values())
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
        discovery_mod.discovery_service.stop()

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
        resp = requests.post(url, files=files, data=data)
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
