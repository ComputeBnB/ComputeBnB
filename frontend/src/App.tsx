import { useState, useEffect, useRef, useCallback } from "react";
import {
  AppStage,
  AppMode,
  Worker,
  WorkerSpecs,
  Job,
  JobResult,
  JobStatus,
  HostingRequest,
  ActiveJob,
} from "./types";
import {
  fetchWorkers,
  fetchWorkerSpecs,
  fetchLocalSpecs,
  startHosting,
  stopHosting,
  fetchHostingRequests,
  fetchActiveJob,
  approveRequest,
  denyRequest,
  submitJob,
  pollJobStatus,
  createJobWebSocket,
} from "./api";
import { WorkerListScreen } from "./screens/WorkerListScreen";
import { SubmitJobScreen } from "./screens/SubmitJobScreen";
import { JobExecutionScreen } from "./screens/JobExecutionScreen";
import { JobCompleteScreen } from "./screens/JobCompleteScreen";
import { HostModeScreen } from "./screens/HostModeScreen";

function App() {
  const [mode, setMode] = useState<AppMode>("guest");
  const [stage, setStage] = useState<AppStage>("discover");

  // Guest state
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [jobStatus, setJobStatus] = useState<JobStatus>("pending");
  const [jobResult, setJobResult] = useState<JobResult | null>(null);

  // Local machine info
  const [localSpecs, setLocalSpecs] = useState<
    (WorkerSpecs & { platform?: string }) | null
  >(null);

  // Host state
  const [hostingRequests, setHostingRequests] = useState<HostingRequest[]>([]);
  const [hostIp, setHostIp] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);

  // Refs for cleanup
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hostPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Worker Discovery ──────────────────────────────────────────────

  const loadWorkers = useCallback(async () => {
    setWorkersLoading(true);
    try {
      const list = await fetchWorkers();
      setWorkers(list);
      // Fetch specs for each worker in parallel
      const specsPromises = list.map(async (w) => {
        try {
          const specs = await fetchWorkerSpecs(w.host, w.port);
          return { id: w.id, specs };
        } catch {
          return { id: w.id, specs: undefined };
        }
      });
      const specsResults = await Promise.all(specsPromises);
      setWorkers((prev) =>
        prev.map((w) => {
          const found = specsResults.find((s) => s.id === w.id);
          return found?.specs ? { ...w, specs: found.specs } : w;
        }),
      );
    } catch (err) {
      console.error("Failed to load workers:", err);
    } finally {
      setWorkersLoading(false);
    }
  }, []);

  // Load workers on mount and when returning to discover
  useEffect(() => {
    if (mode === "guest" && stage === "discover") {
      loadWorkers();
    }
  }, [mode, stage, loadWorkers]);

  // Fetch local machine specs once on mount
  useEffect(() => {
    fetchLocalSpecs()
      .then(setLocalSpecs)
      .catch((err) => console.error("Failed to fetch local specs:", err));
  }, []);

  // ── Guest: Job Submission & Execution ─────────────────────────────

  const handleSelectWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setStage("submit");
  };

  const handleBackToWorkerList = () => {
    setStage("discover");
    setSelectedWorker(null);
  };

  const handleSubmitJob = async (jobData: {
    name: string;
    code: string;
    timeoutSecs: number;
  }) => {
    if (!selectedWorker) return;

    try {
      const result = await submitJob(
        selectedWorker,
        jobData.code,
        jobData.name || "anonymous",
        jobData.timeoutSecs,
      );

      const job: Job = {
        id: `job-${Date.now()}`,
        name: jobData.name || "Untitled Job",
        worker: selectedWorker,
        code: jobData.code,
        requestId: result.request_id,
        timeoutSecs: jobData.timeoutSecs,
        status: "pending",
        startTime: new Date(),
        logs: [],
      };

      setCurrentJob(job);
      setExecutionLogs([]);
      setElapsedTime(0);
      setJobStatus("pending");
      setJobResult(null);
      setStage("execution");

      // Start polling for approval
      startApprovalPolling(selectedWorker, result.request_id);
    } catch (err) {
      console.error("Failed to submit job:", err);
      alert("Failed to submit job. Is the worker still hosting?");
    }
  };

  const startApprovalPolling = (worker: Worker, requestId: string) => {
    // Clear any existing poll
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const status = await pollJobStatus(worker, requestId);
        if (status.status === "accepted" && status.token) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setJobStatus("approved");
          connectWebSocket(worker, requestId, status.token);
        } else if (status.status === "denied") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setJobStatus("denied");
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 2000);
  };

  const connectWebSocket = (
    worker: Worker,
    requestId: string,
    token: string,
  ) => {
    const ws = createJobWebSocket(worker, requestId, token);
    wsRef.current = ws;
    const collectedOutput: string[] = [];

    // Start elapsed time counter
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "status":
          if (msg.state === "running") {
            setJobStatus("running");
          }
          setExecutionLogs((prev) => [...prev, `[status] ${msg.state}`]);
          break;

        case "stdout":
          collectedOutput.push(msg.data);
          setExecutionLogs((prev) => [...prev, msg.data]);
          break;

        case "stderr":
          collectedOutput.push(`[stderr] ${msg.data}`);
          setExecutionLogs((prev) => [...prev, `[stderr] ${msg.data}`]);
          break;

        case "done":
          if (timerRef.current) clearInterval(timerRef.current);
          setJobStatus("done");
          setJobResult({
            exitCode: msg.exit_code,
            runtime: msg.duration_ms / 1000,
            output: collectedOutput.join(""),
          });
          // Small delay so user sees the final log before transitioning
          setTimeout(() => setStage("complete"), 1000);
          break;

        case "error":
          if (timerRef.current) clearInterval(timerRef.current);
          setJobStatus("error");
          setExecutionLogs((prev) => [...prev, `[error] ${msg.message}`]);
          setJobResult({
            exitCode: 1,
            runtime: elapsedTime,
            output: collectedOutput.join(""),
          });
          setTimeout(() => setStage("complete"), 1500);
          break;
      }
    };

    ws.onerror = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setJobStatus("error");
      setExecutionLogs((prev) => [
        ...prev,
        "[error] WebSocket connection failed",
      ]);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  };

  const handleReturnToWorkerList = () => {
    // Cleanup
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStage("discover");
    setSelectedWorker(null);
    setCurrentJob(null);
    setExecutionLogs([]);
    setElapsedTime(0);
    setJobStatus("pending");
    setJobResult(null);
  };

  // ── Host Mode ─────────────────────────────────────────────────────

  const handleStartHosting = async () => {
    try {
      const result = await startHosting();
      setHostIp(result.ip ?? null);
      setMode("host");
      setStage("discover");
      setSelectedWorker(null);
      setCurrentJob(null);

      // Start polling for incoming requests and active job
      hostPollRef.current = setInterval(async () => {
        try {
          const [requests, job] = await Promise.all([
            fetchHostingRequests(),
            fetchActiveJob(),
          ]);
          setHostingRequests(requests);
          setActiveJob(job);
        } catch {
          // Might fail if not hosting anymore
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to start hosting:", err);
      alert("Failed to start hosting. Is the backend running?");
    }
  };

  const handleStopHosting = async () => {
    try {
      await stopHosting();
    } catch (err) {
      console.error("Failed to stop hosting:", err);
    }

    if (hostPollRef.current) {
      clearInterval(hostPollRef.current);
      hostPollRef.current = null;
    }
    setHostingRequests([]);
    setHostIp(null);
    setActiveJob(null);
    setMode("guest");
    setStage("discover");
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await approveRequest(requestId);
      setHostingRequests((prev) =>
        prev.filter((r) => r.request_id !== requestId),
      );
    } catch (err) {
      console.error("Failed to approve:", err);
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      await denyRequest(requestId);
      setHostingRequests((prev) =>
        prev.filter((r) => r.request_id !== requestId),
      );
    } catch (err) {
      console.error("Failed to deny:", err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (wsRef.current) wsRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (hostPollRef.current) clearInterval(hostPollRef.current);
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-app-bg flex flex-col">
      {/* App Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-app-surface-elevated border-b border-app-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-app-accent to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">CB</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-app-text">ComputeBnB</h1>
            <p className="text-xs text-app-text-tertiary">
              Local Compute Sharing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded-md bg-app-surface border border-app-border">
            <span className="text-xs text-app-text-secondary font-mono">
              v0.1.0
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {mode === "host" ? (
          <HostModeScreen
            onStopHosting={handleStopHosting}
            requests={hostingRequests}
            onApprove={handleApproveRequest}
            onDeny={handleDenyRequest}
            hostIp={hostIp}
            activeJob={activeJob}
          />
        ) : (
          <>
            {stage === "discover" && (
              <WorkerListScreen
                workers={workers}
                loading={workersLoading}
                localSpecs={localSpecs}
                onSelectWorker={handleSelectWorker}
                onStartHosting={handleStartHosting}
                onRefresh={loadWorkers}
              />
            )}

            {stage === "submit" && selectedWorker && (
              <SubmitJobScreen
                worker={selectedWorker}
                onBack={handleBackToWorkerList}
                onSubmit={handleSubmitJob}
              />
            )}

            {stage === "execution" && selectedWorker && currentJob && (
              <JobExecutionScreen
                worker={selectedWorker}
                jobName={currentJob.name}
                logs={executionLogs}
                elapsedTime={elapsedTime}
                jobStatus={jobStatus}
                onReturn={handleReturnToWorkerList}
              />
            )}

            {stage === "complete" && selectedWorker && currentJob && (
              <JobCompleteScreen
                worker={selectedWorker}
                jobName={currentJob.name}
                result={jobResult}
                onReturn={handleReturnToWorkerList}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
