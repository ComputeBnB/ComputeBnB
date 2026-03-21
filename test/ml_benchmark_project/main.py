"""
ComputeBnB ML Benchmark — CPU vs GPU stress test.

Runs three benchmarks and writes a JSON report to artifacts/:
  1. Large matrix multiplication (pure compute throughput)
  2. CNN training on synthetic image data (realistic ML workload)
  3. Batched inference pass (simulates production serving)

Automatically uses MPS (Apple Silicon GPU) or CUDA if available,
then re-runs on CPU so you can compare side-by-side.
"""

import platform

import torch

from device import get_best_device
from benchmarks import bench_matmul, bench_training, bench_inference
from report import write_report


def run_suite(device, label):
    print(f"\n{'=' * 60}")
    print(f"  Running benchmarks on: {label} ({device})")
    print(f"{'=' * 60}")

    print("\n[1/3] Matrix Multiplication (4096x4096)...")
    matmul = bench_matmul(device)
    print(f"       Avg: {matmul['avg_sec']:.4f}s  |  {matmul['gflops']} GFLOPS")

    print("\n[2/3] CNN Training (3 epochs, 1280 images/epoch)...")
    training = bench_training(device)
    print(f"       Total: {training['total_time_sec']:.2f}s  |  {training['samples_per_sec']} samples/sec")

    print("\n[3/3] Batched Inference (6400 images)...")
    inference = bench_inference(device)
    print(f"       Avg batch: {inference['avg_batch_ms']:.2f}ms  |  {inference['images_per_sec']} images/sec")

    return {
        "device": label,
        "matmul": matmul,
        "training": training,
        "inference": inference,
    }


def main():
    print("ComputeBnB ML Benchmark")
    print(f"Platform: {platform.platform()}")
    print(f"Processor: {platform.processor()}")
    print(f"PyTorch: {torch.__version__}")

    device, device_label = get_best_device()
    print(f"Best available device: {device_label}")

    results = {
        "platform": platform.platform(),
        "processor": platform.processor(),
        "pytorch_version": torch.__version__,
        "best_device": device_label,
        "benchmarks": {},
    }

    # Always run on CPU
    results["benchmarks"]["cpu"] = run_suite(torch.device("cpu"), "CPU")

    # Run on GPU if available
    if device.type != "cpu":
        results["benchmarks"][device_label.lower()] = run_suite(device, device_label)

        cpu = results["benchmarks"]["cpu"]
        gpu = results["benchmarks"][device_label.lower()]
        print(f"\n{'=' * 60}")
        print(f"  Speedup Summary ({device_label} vs CPU)")
        print(f"{'=' * 60}")
        speedups = {
            "matmul": round(cpu["matmul"]["avg_sec"] / gpu["matmul"]["avg_sec"], 2),
            "training": round(cpu["training"]["total_time_sec"] / gpu["training"]["total_time_sec"], 2),
            "inference": round(cpu["inference"]["total_sec"] / gpu["inference"]["total_sec"], 2),
        }
        results["speedups"] = speedups
        for name, factor in speedups.items():
            print(f"  {name}: {factor}x faster on {device_label}")
    else:
        print("\nNo GPU detected — only CPU results available.")

    write_report(results, device_label)


if __name__ == "__main__":
    main()
