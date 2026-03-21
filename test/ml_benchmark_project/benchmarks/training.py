import torch
import torch.nn as nn
import torch.optim as optim

from device import timed
from model import BenchCNN


def bench_training(device, epochs=3, batch_size=64, num_batches=20):
    """Train BenchCNN on synthetic 32x32 RGB images. Reports samples/sec."""
    model = BenchCNN(num_classes=10).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)

    images = torch.randn(batch_size * num_batches, 3, 32, 32)
    labels = torch.randint(0, 10, (batch_size * num_batches,))

    epoch_times = []
    losses = []

    for epoch in range(epochs):
        model.train()
        epoch_loss = 0.0

        def train_epoch():
            nonlocal epoch_loss
            for i in range(num_batches):
                idx = i * batch_size
                x = images[idx:idx + batch_size].to(device)
                y = labels[idx:idx + batch_size].to(device)

                optimizer.zero_grad()
                out = model(x)
                loss = criterion(out, y)
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()

        elapsed, _ = timed(train_epoch)
        avg_loss = epoch_loss / num_batches
        epoch_times.append(elapsed)
        losses.append(avg_loss)
        print(f"    Epoch {epoch + 1}/{epochs}  loss={avg_loss:.4f}  time={elapsed:.2f}s")

    total_samples = epochs * num_batches * batch_size
    total_time = sum(epoch_times)

    return {
        "epochs": epochs,
        "batch_size": batch_size,
        "num_batches": num_batches,
        "total_samples": total_samples,
        "epoch_times_sec": [round(t, 4) for t in epoch_times],
        "final_loss": round(losses[-1], 4),
        "total_time_sec": round(total_time, 4),
        "samples_per_sec": round(total_samples / total_time, 1),
    }
