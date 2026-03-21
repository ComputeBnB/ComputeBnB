import { ProjectFileUpload, ProjectUpload } from "./types";

export interface SampleProjectData {
  project: ProjectUpload;
  entrypointCode: string;
}

function encodeText(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function createFile(path: string, contents: string): ProjectFileUpload {
  return {
    path,
    content_b64: encodeText(contents),
    size_bytes: new TextEncoder().encode(contents).length,
  };
}

export function buildSampleProject(): SampleProjectData {
  const requirements = [
    "numpy==2.2.4",
    "pandas==2.2.3",
    "requests==2.32.3",
  ].join("\n");

  const main = [
    "import json",
    "",
    "import numpy as np",
    "import pandas as pd",
    "import requests",
    "",
    "",
    "def main() -> None:",
    "    values = np.array([2.5, 4.0, 5.5], dtype=float)",
    '    frame = pd.DataFrame({"value": values})',
    '    frame["scaled"] = frame["value"] * 1.2',
    '    frame["offset"] = frame["scaled"] + 3',
    "",
    "    response = requests.Response()",
    "    response.status_code = 200",
    "",
    "    payload = {",
    '        "mean_value": round(float(frame["value"].mean()), 3),',
    '        "max_offset": round(float(frame["offset"].max()), 3),',
    '        "requests_status": response.status_code,',
    '        "rows": frame.round(3).to_dict(orient="records"),',
    "    }",
    "",
    '    print("ComputeBnB sample project ran in Docker")',
    "    print(json.dumps(payload, indent=2))",
    "",
    "",
    'if __name__ == "__main__":',
    "    main()",
    "",
  ].join("\n");

  const readme = [
    "# ComputeBnB Sample Project",
    "",
    "This sample is meant to be sent from the guest UI to a host machine.",
    "The host should install requirements.txt inside Docker and run main.py.",
    "",
  ].join("\n");

  const files = [
    createFile("main.py", main),
    createFile("requirements.txt", requirements),
    createFile("README.md", readme),
  ];

  return {
    project: {
      name: "Sample Dependency Project",
      entrypoint: "main.py",
      fileCount: files.length,
      hasRequirementsTxt: true,
      files,
    },
    entrypointCode: main,
  };
}
