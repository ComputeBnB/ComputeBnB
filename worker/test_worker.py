"""
Standalone host launcher for local smoke testing.

Run this on one machine to advertise a host and accept ComputeBnB TCP jobs without
opening the React UI.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.discovery import discovery_service
from app.services.host_service import host_service


async def main() -> None:
    discovery_service.start()
    try:
        state = await host_service.start()
        host = state.host
        if not host:
            raise RuntimeError("Host failed to start")

        print(f"Hosting as {host.display_name}")
        print(f"mDNS service: {host.host_id}")
        print(f"TCP target: {host.host}:{host.port}")
        print("Waiting for guest connections. Press Ctrl+C to stop.")

        while True:
            await asyncio.sleep(3600)
    except KeyboardInterrupt:
        print("\nStopping host...")
    finally:
        if host_service.get_state().running:
            await host_service.stop()
        discovery_service.stop()


if __name__ == "__main__":
    asyncio.run(main())
