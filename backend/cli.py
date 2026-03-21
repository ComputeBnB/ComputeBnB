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
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

# Import hosting and discovery services
HOSTING_PATH = os.path.join(BACKEND_PATH, "services", "hosting.py")
DISCOVERY_PATH = os.path.join(BACKEND_PATH, "services", "discovery.py")
hosting_mod = import_backend_module(HOSTING_PATH, "hosting")
discovery_mod = import_backend_module(DISCOVERY_PATH, "discovery")

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
    hosts = await discovery_mod.discover_workers()
    if not hosts:
        print("[Guest] No hosts found.")
        return
    print("[Guest] Found hosts:")
    for idx, host in enumerate(hosts):
        print(f"  [{idx}] {host['display_name']} ({host['ip']}:{host['port']})")
    choice = input("Select host to send job to (number): ")
    try:
        idx = int(choice)
        host = hosts[idx]
    except (ValueError, IndexError):
        print("Invalid selection.")
        return
    code = input("Enter Python code to run on host: ")
    # Send job request (simplified, assumes direct API call)
    import requests
    req = {
        "guest_name": platform.node(),
        "guest_ip": "0.0.0.0",  # Could use socket.gethostbyname
        "code": code,
    }
    url = f"http://{host['ip']}:{host['port']}/jobs/submit"
    print(f"[Guest] Sending job to {url}...")
    resp = requests.post(url, json=req)
    print(f"[Guest] Response: {resp.json()}")

if __name__ == "__main__":
    print("Select mode:")
    print("  1. Host (advertise, accept jobs)")
    print("  2. Guest (discover hosts, send job)")
    mode = input("Enter choice [1/2]: ").strip()
    if mode == "2":
        asyncio.run(run_guest())
    else:
        asyncio.run(run_host())
