from __future__ import annotations

import os
import platform
import socket
from datetime import datetime, timezone


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_display_name() -> str:
    return socket.gethostname() or platform.node() or "ComputeBnB Host"


def get_platform_label() -> str:
    system = platform.system() or "Unknown"
    release = platform.release() or ""
    return f"{system} {release}".strip()


def resolve_local_ip() -> str:
    probes = [("192.0.2.1", 80), ("8.8.8.8", 80)]
    for host, port in probes:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect((host, port))
            address = sock.getsockname()[0]
            if address and not address.startswith("127."):
                return address
        except OSError:
            pass
        finally:
            sock.close()

    try:
        addresses = socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        addresses = []

    for address in addresses:
        if address and not address.startswith("127."):
            return address

    return "127.0.0.1"


def human_bytes(size_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(max(size_bytes, 0))
    unit = units[0]
    for candidate in units:
        unit = candidate
        if size < 1024 or candidate == units[-1]:
            break
        size /= 1024

    if unit == "B":
        return f"{int(size)} {unit}"
    return f"{size:.1f} {unit}"


def getenv_bool(name: str) -> bool:
    value = os.getenv(name, "").strip().lower()
    return value in {"1", "true", "yes", "on"}
