import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  createJobSocket,
  decidePendingJob,
  fetchHosts,
  fetchLocalHostState,
  startLocalHost,
  stopLocalHost,
} from "./api";
import { HostModeScreen } from "./screens/HostModeScreen";
import { JobCompleteScreen } from "./screens/JobCompleteScreen";
import { JobExecutionScreen } from "./screens/JobExecutionScreen";
import { SubmitJobScreen } from "./screens/SubmitJobScreen";
import { WorkerListScreen } from "./screens/WorkerListScreen";
import type {
  AppMode,
  AppStage,
  Host,
  JobResult,
  JobSession,
  JobState,
  LocalHostState,
  ManualHostInput,
} from "./types";

const EMPTY_HOST_STATE: LocalHostState = {
  running: false,
  host: null,
  pending_job: null,
  active_job: null,
  activity: [],
  recent_results: [],
};

function App() {
  const [mode, setMode] = useState<AppMode>("guest");
  const [stage, setStage] = useState<AppStage>("discover");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [currentJob, setCurrentJob] = useState<JobSession | null>(null);
  const [jobResult, setJobResult] = useState<JobResult | null>(null);
  const [localHostState, setLocalHostState] = useState<LocalHostState>(EMPTY_HOST_STATE);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const currentJobRef = useRef<JobSession | null>(null);
  const elapsedTimeRef = useRef(0);

  useEffect(() => {
    currentJobRef.current = currentJob;
  }, [currentJob]);

  useEffect(() => {
    elapsedTimeRef.current = elapsedTime;
  }, [elapsedTime]);

  useEffect(() => {
    let cancelled = false;

    const loadHosts = async () => {
      try {
        const nextHosts = await fetchHosts();
        if (!cancelled) {
          setHosts(nextHosts);
          setGuestError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setGuestError(getErrorMessage(error, "Unable to load hosts."));
        }
      }
    };

    void loadHosts();
    const intervalId = window.setInterval(() => {
      void loadHosts();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLocalHostState = async () => {
      try {
        const nextState = await fetchLocalHostState();
        if (!cancelled) {
          setLocalHostState(nextState);
          if (nextState.running) {
            setMode("host");
          }
          setHostError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setHostError(getErrorMessage(error, "Unable to load local host state."));
        }
      }
    };

    void loadLocalHostState();
    const intervalId = window.setInterval(() => {
      void loadLocalHostState();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  const handleSelectWorker = (worker: Host) => {
    setSelectedHost(worker);
    setStage("submit");
    setGuestError(null);
  };

  const handleManualConnect = (manualHost: ManualHostInput) => {
    handleSelectWorker({
      host_id: "manual",
      display_name: manualHost.display_name,
      host: manualHost.host,
      port: manualHost.port,
      status: "idle",
      platform: "Manual target",
      runtime: "docker-first",
      last_seen: "manual entry",
      manual: true,
    });
  };

  const handleBackToWorkerList = () => {
    socketRef.current?.close();
    socketRef.current = null;
    setStage("discover");
    setSelectedHost(null);
    setCurrentJob(null);
    setJobResult(null);
    setExecutionLogs([]);
    setElapsedTime(0);
    setGuestError(null);
  };

  const handleSubmitJob = (jobData: {
    name: string;
    code: string;
    filename: string;
    timeoutSecs: number;
  }) => {
    if (!selectedHost) {
      return;
    }

    setExecutionLogs([]);
    setElapsedTime(0);
    setJobResult(null);
    setGuestError(null);
    setStage("execution");

    const placeholderId = `job-${Date.now()}`;
    setCurrentJob({
      id: placeholderId,
      name: jobData.name,
      host: selectedHost,
      state: "pending",
      filename: jobData.filename,
    });

    socketRef.current?.close();
    const socket = createJobSocket(selectedHost.manual ? "manual" : selectedHost.host_id);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          job_name: jobData.name,
          code: jobData.code,
          filename: jobData.filename,
          timeout_secs: jobData.timeoutSecs,
          ...(selectedHost.manual ? { host: selectedHost.host, port: selectedHost.port } : {}),
        }),
      );
      appendLog(setExecutionLogs, `[guest] Sent job request to ${selectedHost.display_name}`);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as Record<string, unknown>;
        handleSocketMessage(message);
      } catch {
        appendLog(setExecutionLogs, `[error] Received an invalid response from the host bridge.`);
      }
    };

    socket.onerror = () => {
      setGuestError("The TCP bridge could not connect to the selected host.");
    };

    socket.onclose = () => {
      socketRef.current = null;
    };
  };

  const handleStartHosting = async () => {
    try {
      const nextState = await startLocalHost();
      setLocalHostState(nextState);
      setMode("host");
      setHostError(null);
    } catch (error) {
      setHostError(getErrorMessage(error, "Unable to start host mode."));
    }
  };

  const handleStopHosting = async () => {
    try {
      const nextState = await stopLocalHost();
      setLocalHostState(nextState);
      setHostError(null);
    } catch (error) {
      setHostError(getErrorMessage(error, "Unable to stop host mode."));
    } finally {
      setMode("guest");
      setStage("discover");
    }
  };

  const handleHostDecision = async (jobId: string, decision: "accept" | "deny") => {
    try {
      const nextState = await decidePendingJob(jobId, decision);
      setLocalHostState(nextState);
      setHostError(null);
    } catch (error) {
      setHostError(getErrorMessage(error, "Unable to send the host decision."));
    }
  };

  const handleSocketMessage = (message: Record<string, unknown>) => {
    const messageType = String(message.type || "");
    const messageJobId = typeof message.job_id === "string" ? message.job_id : undefined;

    if (messageJobId) {
      setCurrentJob((job) => (job ? { ...job, id: messageJobId } : job));
    }

    if (messageType === "status") {
      const state = String(message.state || "pending") as JobState;
      const statusMessage = typeof message.message === "string" ? message.message : `Job state: ${state}`;
      setCurrentJob((job) => (job ? { ...job, state } : job));
      appendLog(setExecutionLogs, `[status] ${statusMessage}`);
      return;
    }

    if (messageType === "stdout") {
      appendLog(setExecutionLogs, `[stdout] ${String(message.data || "")}`);
      return;
    }

    if (messageType === "stderr") {
      appendLog(setExecutionLogs, `[stderr] ${String(message.data || "")}`);
      return;
    }

    if (messageType === "metrics") {
      const elapsedSecs = Number(message.elapsed_secs || 0);
      setElapsedTime(elapsedSecs);
      return;
    }

    if (messageType === "done") {
      const result = message as unknown as JobResult;
      setElapsedTime(result.duration_ms / 1000);
      setJobResult(result);
      setCurrentJob((job) => (job ? { ...job, state: result.state } : job));
      appendLog(setExecutionLogs, `[done] ${result.summary}`);
      setStage("complete");
      socketRef.current?.close();
      return;
    }

    if (messageType === "error") {
      const detail = String(message.message || "The host returned an error.");
      const fallbackState: JobState =
        currentJobRef.current?.state === "awaiting_accept" ? "denied" : "failed";
      const result: JobResult = {
        type: "done",
        job_id: messageJobId || currentJobRef.current?.id || `job-${Date.now()}`,
        state: fallbackState,
        exit_code: -1,
        duration_ms: Math.round(elapsedTimeRef.current * 1000),
        backend: "unavailable",
        artifacts: [],
        summary: detail,
        error: detail,
      };
      setJobResult(result);
      setCurrentJob((job) => (job ? { ...job, state: fallbackState } : job));
      appendLog(setExecutionLogs, `[error] ${detail}`);
      setStage("complete");
      socketRef.current?.close();
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-app-bg">
      <div className="flex items-center justify-between border-b border-app-border bg-app-surface-elevated px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-app-accent to-sky-500">
            <span className="text-sm font-bold text-white">CB</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-app-text">ComputeBnB</h1>
            <p className="text-xs text-app-text-tertiary">LAN Python jobs with host approval and live output</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-app-border bg-app-surface px-2 py-1">
            <span className="font-mono text-xs text-app-text-secondary">v0.1.0</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === "host" ? (
          <HostModeScreen
            state={localHostState}
            onStopHosting={handleStopHosting}
            onDecision={handleHostDecision}
            errorMessage={hostError}
          />
        ) : (
          <>
            {stage === "discover" && (
              <WorkerListScreen
                workers={hosts}
                onSelectWorker={handleSelectWorker}
                onStartHosting={handleStartHosting}
                onRefresh={() => {
                  void fetchHosts()
                    .then((nextHosts) => {
                      setHosts(nextHosts);
                      setGuestError(null);
                    })
                    .catch((error) => setGuestError(getErrorMessage(error, "Unable to refresh hosts.")));
                }}
                errorMessage={guestError}
                onManualConnect={handleManualConnect}
              />
            )}

            {stage === "submit" && selectedHost && (
              <SubmitJobScreen
                worker={selectedHost}
                onBack={handleBackToWorkerList}
                onSubmit={handleSubmitJob}
              />
            )}

            {stage === "execution" && selectedHost && currentJob && (
              <JobExecutionScreen
                worker={selectedHost}
                jobName={currentJob.name}
                logs={executionLogs}
                elapsedTime={elapsedTime}
                state={currentJob.state}
              />
            )}

            {stage === "complete" && selectedHost && currentJob && jobResult && (
              <JobCompleteScreen
                worker={selectedHost}
                jobName={currentJob.name}
                result={jobResult}
                logs={executionLogs}
                onReturn={handleBackToWorkerList}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function appendLog(setter: Dispatch<SetStateAction<string[]>>, line: string) {
  setter((previous) => [...previous, line.trimEnd()]);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default App;
