"""
Specs router - returns this machine's hardware information.
"""

import platform
import subprocess
from fastapi import APIRouter

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

router = APIRouter(tags=["specs"])


def _detect_gpu() -> str | None:
    # Try NVIDIA
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split("\n")[0]
    except Exception:
        pass

    # Apple Silicon GPU
    if platform.system() == "Darwin" and "arm" in platform.machine().lower():
        return f"Apple {platform.machine()} GPU"

    return None


@router.get("/specs")
async def get_specs():
    cpu = platform.processor() or platform.machine() or "Unknown"
    cpu_cores = psutil.cpu_count(logical=True) if HAS_PSUTIL else 0
    ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 1) if HAS_PSUTIL else 0
    gpu = _detect_gpu()

    return {
        "cpu": cpu,
        "cpu_cores": cpu_cores,
        "ram": f"{ram_gb} GB",
        "gpu": gpu,
        "platform": platform.system(),
    }
