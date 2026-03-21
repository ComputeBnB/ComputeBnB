import numpy as np
import torch

from device import timed


def bench_matmul(device, size=4096, iterations=5):
    """Multiply two large square matrices repeatedly. Reports GFLOPS."""
    a = torch.randn(size, size, device=device)
    b = torch.randn(size, size, device=device)

    # Warmup
    _ = a @ b

    times = []
    for _ in range(iterations):
        elapsed, _ = timed(lambda: a @ b)
        times.append(elapsed)

    return {
        "matrix_size": size,
        "iterations": iterations,
        "times_sec": [round(t, 4) for t in times],
        "avg_sec": round(np.mean(times), 4),
        "gflops": round((2 * size**3) / (np.mean(times) * 1e9), 2),
    }
