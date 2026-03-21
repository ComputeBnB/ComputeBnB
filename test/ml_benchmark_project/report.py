import json
from pathlib import Path


def write_report(results, device_label):
    """Write JSON report and text summary to artifacts/."""
    artifacts = Path("artifacts")
    artifacts.mkdir(parents=True, exist_ok=True)

    report_path = artifacts / "benchmark_report.json"
    report_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nReport saved to {report_path}")

    lines = [
        "ComputeBnB ML Benchmark Results",
        f"Platform: {results['platform']}",
        f"PyTorch: {results['pytorch_version']}",
        f"Best device: {results['best_device']}",
        "",
    ]

    for label, bench in results["benchmarks"].items():
        lines.append(f"--- {label.upper()} ---")
        lines.append(f"  Matrix multiply: {bench['matmul']['gflops']} GFLOPS")
        lines.append(f"  Training throughput: {bench['training']['samples_per_sec']} samples/sec")
        lines.append(f"  Inference throughput: {bench['inference']['images_per_sec']} images/sec")
        lines.append("")

    if "speedups" in results:
        lines.append(f"--- SPEEDUP ({device_label} vs CPU) ---")
        for name, factor in results["speedups"].items():
            lines.append(f"  {name}: {factor}x")

    summary_path = artifacts / "summary.txt"
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Summary saved to {summary_path}")
