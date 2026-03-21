# pyright: reportMissingImports=false

import json

import numpy as np
import requests
import torch


def main() -> None:
    matrix = np.array([[1.0, 2.0], [3.0, 4.0]])
    vector = np.array([0.5, 1.5])
    product = matrix @ vector

    tensor = torch.tensor(product, dtype=torch.float32)
    activated = torch.nn.functional.relu(tensor)

    response = requests.Response()
    response.status_code = 200

    result = {
        "numpy_product": product.round(3).tolist(),
        "torch_sum": round(float(activated.sum().item()), 3),
        "requests_status": response.status_code,
    }

    print("Sample dependency check passed")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
