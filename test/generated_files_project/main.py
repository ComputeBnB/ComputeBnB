# pyright: reportMissingImports=false

import json
from pathlib import Path

import numpy as np
import pandas as pd


def main() -> None:
    artifacts_dir = Path("artifacts")
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    values = np.array([3.0, 6.0, 9.0, 12.0], dtype=float)
    frame = pd.DataFrame(
        {
            "input": values,
            "squared": values ** 2,
            "normalized": values / values.max(),
        }
    )

    summary_path = artifacts_dir / "summary.txt"
    summary_path.write_text(
        "Generated on host inside Docker\n"
        f"Rows: {len(frame)}\n"
        f"Mean squared value: {frame['squared'].mean():.2f}\n",
        encoding="utf-8",
    )

    report_path = artifacts_dir / "report.json"
    report_path.write_text(
        json.dumps(
            {
                "columns": list(frame.columns),
                "records": frame.round(4).to_dict(orient="records"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print("Generated artifacts:")
    print(f"- {summary_path}")
    print(f"- {report_path}")


if __name__ == "__main__":
    main()
