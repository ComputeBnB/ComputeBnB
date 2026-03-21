import React, { useState } from "react";
import {
  ArrowLeft,
  Upload,
  PlayCircle,
  Cpu,
  HardDrive,
  Layers,
  Clock,
  Globe,
  FolderOpen,
} from "lucide-react";
import { buildSampleProject } from "../sampleProject";
import { ProjectFileUpload, ProjectUpload, Worker } from "../types";

type TauriDialogModule = typeof import("@tauri-apps/api/dialog");
type TauriFsModule = typeof import("@tauri-apps/api/fs");

interface FsEntry {
  path: string;
  name?: string;
  children?: FsEntry[];
}

const IGNORED_SEGMENTS = new Set([
  ".git",
  ".venv",
  "__pycache__",
  "node_modules",
  ".pytest_cache",
  ".mypy_cache",
  ".idea",
  ".vscode",
  "dist",
  "build",
]);

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function fileNameFromPath(value: string): string {
  const normalized = normalizePath(value).replace(/\/$/, "");
  return normalized.split("/").filter(Boolean).pop() || normalized;
}

function relativeProjectPath(rootPath: string, filePath: string): string {
  const normalizedRoot = normalizePath(rootPath).replace(/\/$/, "");
  const normalizedFile = normalizePath(filePath);
  if (normalizedFile.startsWith(`${normalizedRoot}/`)) {
    return normalizedFile.slice(normalizedRoot.length + 1);
  }
  return fileNameFromPath(normalizedFile);
}

function shouldIgnoreRelativePath(relativePath: string): boolean {
  const segments = normalizePath(relativePath).split("/").filter(Boolean);
  return segments.some(
    (segment) =>
      IGNORED_SEGMENTS.has(segment) ||
      segment === ".DS_Store" ||
      segment.endsWith(".pyc"),
  );
}

function flattenEntries(entries: FsEntry[]): string[] {
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.children) {
      files.push(...flattenEntries(entry.children));
      continue;
    }

    files.push(entry.path);
  }

  return files;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function textToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

function base64ToText(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function detectEntrypoint(files: ProjectFileUpload[]): string | null {
  const normalizedPaths = files.map((file) => normalizePath(file.path));

  if (normalizedPaths.includes("main.py")) {
    return "main.py";
  }

  const mainCandidates = normalizedPaths
    .filter((path) => fileNameFromPath(path) === "main.py")
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));

  if (mainCandidates.length > 0) {
    return mainCandidates[0];
  }

  const pythonFiles = normalizedPaths.filter((path) => path.endsWith(".py")).sort();
  return pythonFiles.length === 1 ? pythonFiles[0] : null;
}

function sanitizeCodeInput(value: string): string {
  return value.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
}

let tauriDialog: TauriDialogModule | null = null;
let tauriFs: TauriFsModule | null = null;

try {
  import("@tauri-apps/api/dialog").then((module) => {
    tauriDialog = module;
  });
  import("@tauri-apps/api/fs").then((module) => {
    tauriFs = module;
  });
} catch {
  // Not running in Tauri.
}

interface SubmitJobScreenProps {
  worker: Worker;
  onBack: () => void;
  onSubmit: (jobData: {
    name: string;
    code: string;
    filename: string;
    entrypoint: string;
    projectName?: string;
    projectFiles?: ProjectFileUpload[];
    hasRequirementsTxt?: boolean;
    timeoutSecs: number;
  }) => void;
}

export const SubmitJobScreen: React.FC<SubmitJobScreenProps> = ({
  worker,
  onBack,
  onSubmit,
}) => {
  const [jobName, setJobName] = useState("");
  const [code, setCode] = useState("");
  const [timeoutSecs, setTimeoutSecs] = useState(300);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [projectUpload, setProjectUpload] = useState<ProjectUpload | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    if (projectUpload) {
      onSubmit({
        name: jobName || projectUpload.name || "Untitled Job",
        code,
        filename: projectUpload.entrypoint,
        entrypoint: projectUpload.entrypoint,
        projectName: projectUpload.name,
        projectFiles: projectUpload.files,
        hasRequirementsTxt: projectUpload.hasRequirementsTxt,
        timeoutSecs,
      });
      return;
    }

    const filename = loadedFileName || "main.py";
    onSubmit({
      name: jobName || "Untitled Job",
      code,
      filename,
      entrypoint: filename,
      timeoutSecs,
    });
  };

  const handleCodeChange = (value: string) => {
    const sanitized = sanitizeCodeInput(value);
    setCode(sanitized);
    setProjectError(null);

    if (!projectUpload) {
      setLoadedFileName(null);
      return;
    }

    setProjectUpload((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        files: prev.files.map((file) =>
          normalizePath(file.path) === prev.entrypoint
            ? {
                ...file,
                content_b64: textToBase64(sanitized),
                size_bytes: new TextEncoder().encode(sanitized).length,
              }
            : file,
        ),
      };
    });
  };

  const handleBrowseFile = async () => {
    if (!tauriDialog || !tauriFs) {
      alert("File browsing is only available in the desktop app.");
      return;
    }

    try {
      const selected = await tauriDialog.open({
        multiple: false,
        filters: [{ name: "Python", extensions: ["py"] }],
      });

      if (selected && typeof selected === "string") {
        const contents = await tauriFs.readTextFile(selected);
        const fileName = fileNameFromPath(selected);
        setCode(contents);
        setLoadedFileName(fileName);
        setProjectUpload(null);
        setProjectError(null);
      }
    } catch (err) {
      console.error("File browse error:", err);
    }
  };

  const handleBrowseProject = async () => {
    if (!tauriDialog || !tauriFs) {
      alert("Project upload is only available in the desktop app.");
      return;
    }

    try {
      const selected = await tauriDialog.open({
        directory: true,
        multiple: false,
      });

      if (!selected || typeof selected !== "string") return;

      const entries = (await tauriFs.readDir(selected, {
        recursive: true,
      })) as FsEntry[];
      const rootPath = normalizePath(selected);
      const files: ProjectFileUpload[] = [];

      for (const filePath of flattenEntries(entries)) {
        const relativePath = relativeProjectPath(rootPath, filePath);

        if (!relativePath || shouldIgnoreRelativePath(relativePath)) {
          continue;
        }

        const bytes = await tauriFs.readBinaryFile(filePath);
        files.push({
          path: relativePath,
          content_b64: bytesToBase64(bytes),
          size_bytes: bytes.byteLength,
        });
      }

      if (files.length === 0) {
        setProjectError("No readable project files were found in the selected folder.");
        return;
      }

      const entrypoint = detectEntrypoint(files);
      if (!entrypoint) {
        setProjectUpload(null);
        setProjectError(
          "Project upload needs a root main.py, any main.py entrypoint, or exactly one Python file.",
        );
        return;
      }

      const entrypointFile = files.find(
        (file) => normalizePath(file.path) === entrypoint,
      );
      const projectName = fileNameFromPath(rootPath);
      const hasRequirementsTxt = files.some(
        (file) => fileNameFromPath(file.path) === "requirements.txt",
      );

      setProjectUpload({
        name: projectName,
        entrypoint,
        fileCount: files.length,
        hasRequirementsTxt,
        files,
      });
      setLoadedFileName(entrypoint);
      setCode(entrypointFile ? base64ToText(entrypointFile.content_b64) : "");
      setProjectError(null);
      if (!jobName) {
        setJobName(projectName);
      }
    } catch (err) {
      console.error("Project browse error:", err);
      setProjectError("Failed to load the selected project folder.");
    }
  };

  const handleLoadSampleProject = () => {
    const sample = buildSampleProject();
    setProjectUpload(sample.project);
    setLoadedFileName(sample.project.entrypoint);
    setCode(sample.entrypointCode);
    setProjectError(null);

    if (!jobName) {
      setJobName(sample.project.name);
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 px-8 py-6 border-b border-app-border">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-app-surface-elevated border border-transparent hover:border-app-border transition-all"
        >
          <ArrowLeft size={20} className="text-app-text-secondary" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-1">Submit Job</h1>
          <p className="text-sm text-app-text-secondary">
            Upload a Python project or send a single script to run inside Docker
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="p-4 rounded-lg bg-app-surface border border-app-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wide">
                Selected Worker
              </h3>
              <button
                onClick={onBack}
                className="text-xs text-app-accent hover:text-app-accent-hover transition-colors"
              >
                Change
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-base font-semibold text-app-text">
                {worker.name}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {worker.specs ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Cpu size={14} className="text-app-text-tertiary" />
                      <span className="text-app-text-secondary">
                        {worker.specs.cpuCores} cores
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive size={14} className="text-app-text-tertiary" />
                      <span className="text-app-text-secondary">
                        {worker.specs.ram}
                      </span>
                    </div>
                    {worker.specs.gpu && (
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-app-text-tertiary" />
                        <span className="text-app-text-secondary">GPU</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-app-text-tertiary" />
                    <span className="text-app-text-secondary">
                      {worker.host}:{worker.port}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Job Name
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g., ML Model Training"
                className="w-full px-4 py-2.5 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors"
              />
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-sm font-medium text-app-text mb-1">
                Dependency Notice
              </div>
              <p className="text-xs text-app-text-secondary leading-relaxed">
                If your project uses non-standard Python packages, include a
                {" "}<code>requirements.txt</code>{" "}
                file in the uploaded project. The host will install it inside the Docker container before running your entrypoint.
              </p>
            </div>

            {projectUpload && (
              <div className="rounded-xl border border-app-border bg-app-surface p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-app-text">
                      Project Ready
                    </div>
                    <div className="text-xs text-app-text-tertiary mt-1">
                      {projectUpload.name} · {projectUpload.fileCount} files · entrypoint {projectUpload.entrypoint}
                    </div>
                  </div>
                  {projectUpload.hasRequirementsTxt ? (
                    <span className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      requirements.txt found
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      no requirements.txt
                    </span>
                  )}
                </div>
                <p className="text-xs text-app-text-secondary leading-relaxed">
                  The preview below shows the detected entrypoint. Editing it here updates the uploaded project before submission.
                </p>
              </div>
            )}

            {projectError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {projectError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                {projectUpload ? "Entrypoint Preview" : "Python Code"}{" "}
                <span className="text-app-error">*</span>
              </label>
              <textarea
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder={'# Write your Python code here\nprint("Hello from ComputeBnB!")'}
                rows={12}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-gramm="false"
                className="w-full px-4 py-3 rounded-lg bg-app-surface border border-app-border text-app-text placeholder:text-app-text-tertiary focus:outline-none focus:border-app-accent transition-colors font-mono text-sm leading-relaxed resize-none"
              />
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:text-app-text border border-app-border hover:bg-app-surface-elevated transition-all"
                >
                  <Upload size={14} />
                  <span>Load single file</span>
                </button>
                <button
                  type="button"
                  onClick={handleBrowseProject}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:text-app-text border border-app-border hover:bg-app-surface-elevated transition-all"
                >
                  <FolderOpen size={14} />
                  <span>Load project folder</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleProject}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:text-app-text border border-app-border hover:bg-app-surface-elevated transition-all"
                >
                  <Layers size={14} />
                  <span>Load sample project</span>
                </button>
                {loadedFileName && (
                  <span className="text-xs text-app-text-tertiary">
                    Loaded: {loadedFileName}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Timeout
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="number"
                    value={timeoutSecs}
                    onChange={(e) =>
                      setTimeoutSecs(
                        Math.max(10, parseInt(e.target.value, 10) || 300),
                      )
                    }
                    min={10}
                    max={3600}
                    className="w-full px-4 py-2.5 pl-10 rounded-lg bg-app-surface border border-app-border text-app-text focus:outline-none focus:border-app-accent transition-colors"
                  />
                  <Clock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-tertiary"
                  />
                </div>
                <span className="text-sm text-app-text-secondary">seconds</span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={!code.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-medium transition-all shadow-lg shadow-app-accent/20 hover:shadow-app-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayCircle size={20} />
                <span>Run Job</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
