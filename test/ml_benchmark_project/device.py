import time

import torch


def get_best_device():
    if torch.cuda.is_available():
        return torch.device("cuda"), "CUDA"
    if torch.backends.mps.is_available():
        return torch.device("mps"), "MPS"
    return torch.device("cpu"), "CPU"


def timed(fn):
    """Run fn() and return (elapsed_seconds, result) with device sync."""
    if torch.cuda.is_available():
        torch.cuda.synchronize()
    start = time.perf_counter()
    result = fn()
    if torch.cuda.is_available():
        torch.cuda.synchronize()
    elif torch.backends.mps.is_available():
        torch.mps.synchronize()
    elapsed = time.perf_counter() - start
    return elapsed, result
