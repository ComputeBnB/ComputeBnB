import numpy as np
import torch

from device import timed
from model import BenchCNN


def bench_inference(device, batch_size=128, num_batches=50):
    """Run forward passes through BenchCNN without gradients. Reports images/sec."""
    model = BenchCNN(num_classes=10).to(device)
    model.eval()

    images = torch.randn(batch_size, 3, 32, 32)

    # Warmup
    with torch.no_grad():
        _ = model(images.to(device))

    times = []
    for _ in range(num_batches):
        batch = images.to(device)
        elapsed, _ = timed(lambda: model(batch))
        times.append(elapsed)

    total_images = batch_size * num_batches

    return {
        "batch_size": batch_size,
        "num_batches": num_batches,
        "total_images": total_images,
        "avg_batch_ms": round(np.mean(times) * 1000, 2),
        "total_sec": round(sum(times), 4),
        "images_per_sec": round(total_images / sum(times), 1),
    }
