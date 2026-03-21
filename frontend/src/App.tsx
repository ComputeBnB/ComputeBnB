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
  ProjectFileUpload,
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
  payForJob,
  submitJob,
  pollJobStatus,
  createJobWebSocket,
} from "./api";
import { WorkerListScreen } from "./screens/WorkerListScreen";
import { SubmitJobScreen } from "./screens/SubmitJobScreen";
import { JobExecutionScreen } from "./screens/JobExecutionScreen";
import { JobCompleteScreen } from "./screens/JobCompleteScreen";
import { HostModeScreen } from "./screens/HostModeScreen";

const MINIMUM_DEMO_CHARGE_USD = 0.25;

function computeDemoCharge(
  chargeEnabled: boolean,
  chargeRateUsdPerHour: number,
  elapsedTime: number,
): number {
  if (!chargeEnabled || chargeRateUsdPerHour <= 0) return 0;

  const usageCharge = (chargeRateUsdPerHour * elapsedTime) / 3600;
  return Number(Math.max(MINIMUM_DEMO_CHARGE_USD, usageCharge).toFixed(2));
}

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
  const [jobPhase, setJobPhase] = useState<string>("pending_approval");
  const [jobPhaseDetail, setJobPhaseDetail] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<JobResult | null>(null);
  const [isPayingForJob, setIsPayingForJob] = useState(false);

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
    filename: string;
    entrypoint: string;
    projectName?: string;
    projectFiles?: {
      path: string;
      content_b64: string;
      size_bytes: number;
    }[];
    hasRequirementsTxt?: boolean;
    timeoutSecs: number;
  }) => {
    if (!selectedWorker) return;

    try {
      const result = await submitJob(selectedWorker, {
        code: jobData.code,
        filename: jobData.filename,
        entrypoint: jobData.entrypoint,
        projectName: jobData.projectName,
        projectFiles: jobData.projectFiles,
        guestName: jobData.name || "anonymous",
        timeoutSecs: jobData.timeoutSecs,
      });

      const job: Job = {
        id: `job-${Date.now()}`,
        name: jobData.name || "Untitled Job",
        worker: selectedWorker,
        code: jobData.code,
        filename: jobData.filename,
        entrypoint: jobData.entrypoint,
        projectName: jobData.projectName,
        projectFileCount: jobData.projectFiles?.length,
        hasRequirementsTxt: jobData.hasRequirementsTxt,
        projectFiles: jobData.projectFiles,
        chargeEnabled: false,
        chargeFinalized: false,
        chargeRateUsdPerHour: 0,
        totalChargeUsd: 0,
        balanceDueUsd: 0,
        paid: false,
        paymentStatus: "not_required",
        requestId: result.request_id,
        timeoutSecs: jobData.timeoutSecs,
        status: "pending",
        phase: "pending_approval",
        startTime: new Date(),
        logs: [],
      };

      setCurrentJob(job);
      setExecutionLogs([]);
      setElapsedTime(0);
      setJobStatus("pending");
      setJobPhase("pending_approval");
      setJobPhaseDetail("Waiting for the host to approve your project upload.");
      setJobResult(null);
      setIsPayingForJob(false);
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
          const chargeEnabled = status.charge_enabled ?? false;
          const chargeRateUsdPerHour = status.charge_rate_usd_per_hour ?? 0;
          setJobStatus("approved");
          setJobPhase("approved");
          setJobPhaseDetail(
            chargeEnabled
              ? `Host approved the job. Compute is billable at $${chargeRateUsdPerHour.toFixed(2)}/hr.`
              : "Host approved the job. Connecting to the Docker runtime.",
          );
          setCurrentJob((prev) =>
            prev && prev.requestId === requestId
              ? {
                  ...prev,
                  chargeEnabled,
                  chargeFinalized: false,
                  chargeRateUsdPerHour,
                  paymentStatus: "not_required",
                }
              : prev,
          );
          connectWebSocket(
            worker,
            requestId,
            status.token,
            chargeEnabled,
            chargeRateUsdPerHour,
          );
        } else if (status.status === "denied") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setJobStatus("denied");
          setJobPhase("denied");
          setJobPhaseDetail("The host denied this job request.");
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
    chargeEnabled: boolean,
    chargeRateUsdPerHour: number,
  ) => {
    const ws = createJobWebSocket(worker, requestId, token);
    wsRef.current = ws;
    const collectedOutput: string[] = [];
    const collectedGeneratedFiles: ProjectFileUpload[] = [];

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
          } else if (msg.state === "timeout") {
            setJobStatus("timeout");
          } else if (msg.state === "failed") {
            setJobStatus("error");
          } else if (msg.state !== "done") {
            setJobStatus("approved");
          }
          setJobPhase(msg.state);
          setJobPhaseDetail(msg.detail ?? null);
          setExecutionLogs((prev) => [
            ...prev,
            msg.detail ? `[status] ${msg.state}: ${msg.detail}` : `[status] ${msg.state}`,
          ]);
          break;

        case "stdout":
          collectedOutput.push(msg.data);
          setExecutionLogs((prev) => [...prev, msg.data]);
          break;

        case "stderr":
          collectedOutput.push(`[stderr] ${msg.data}`);
          setExecutionLogs((prev) => [...prev, `[stderr] ${msg.data}`]);
          break;

        case "generated_file":
          collectedGeneratedFiles.push({
            path: msg.path,
            content_b64: msg.content_b64,
            size_bytes: msg.size_bytes,
          });
          setExecutionLogs((prev) => [
            ...prev,
            `[artifact] Received ${msg.path} (${msg.size_bytes} bytes)`,
          ]);
          break;

        case "done":
          if (timerRef.current) clearInterval(timerRef.current);
          setJobStatus("done");
          setJobPhase(msg.exit_code === 0 ? "done" : "failed");
          setJobPhaseDetail(
            msg.exit_code === 0
              ? "Docker execution finished successfully."
              : `Docker execution finished with exit code ${msg.exit_code}.`,
          );
          setJobResult({
            exitCode: msg.exit_code,
            runtime: msg.duration_ms / 1000,
            output: collectedOutput.join(""),
            generatedFiles: [...collectedGeneratedFiles],
            chargeEnabled: msg.charge_enabled ?? chargeEnabled,
            chargeFinalized: msg.charge_finalized ?? true,
            chargeRateUsdPerHour:
              msg.charge_rate_usd_per_hour ?? chargeRateUsdPerHour,
            totalChargeUsd: msg.total_charge_usd ?? 0,
            balanceDueUsd: msg.balance_due_usd ?? 0,
            paid: msg.paid ?? false,
            paymentStatus:
              msg.payment_status ??
              ((msg.charge_enabled ?? chargeEnabled) ? "payment_due" : "not_required"),
          });
          setCurrentJob((prev) =>
            prev && prev.requestId === requestId
              ? {
                  ...prev,
                  chargeEnabled: msg.charge_enabled ?? chargeEnabled,
                  chargeFinalized: msg.charge_finalized ?? true,
                  chargeRateUsdPerHour:
                    msg.charge_rate_usd_per_hour ?? chargeRateUsdPerHour,
                  totalChargeUsd: msg.total_charge_usd ?? 0,
                  balanceDueUsd: msg.balance_due_usd ?? 0,
                  paid: msg.paid ?? false,
                  paymentStatus:
                    msg.payment_status ??
                    ((msg.charge_enabled ?? chargeEnabled)
                      ? "payment_due"
                      : "not_required"),
                }
              : prev,
          );
          // Small delay so user sees the final log before transitioning
          setTimeout(() => setStage("complete"), 1000);
          break;

        case "error":
          if (timerRef.current) clearInterval(timerRef.current);
          setJobStatus(msg.message?.toLowerCase().includes("timed out") ? "timeout" : "error");
          setJobPhase(msg.message?.toLowerCase().includes("timed out") ? "timeout" : "error");
          setJobPhaseDetail(msg.message);
          setExecutionLogs((prev) => [...prev, `[error] ${msg.message}`]);
          setJobResult({
            exitCode: 1,
            runtime: elapsedTime,
            output: collectedOutput.join(""),
            generatedFiles: [...collectedGeneratedFiles],
            chargeEnabled: msg.charge_enabled ?? chargeEnabled,
            chargeFinalized: msg.charge_finalized ?? true,
            chargeRateUsdPerHour:
              msg.charge_rate_usd_per_hour ?? chargeRateUsdPerHour,
            totalChargeUsd: msg.total_charge_usd ?? 0,
            balanceDueUsd: msg.balance_due_usd ?? 0,
            paid: msg.paid ?? false,
            paymentStatus:
              msg.payment_status ??
              ((msg.charge_enabled ?? chargeEnabled) ? "payment_due" : "not_required"),
          });
          setCurrentJob((prev) =>
            prev && prev.requestId === requestId
              ? {
                  ...prev,
                  chargeEnabled: msg.charge_enabled ?? chargeEnabled,
                  chargeFinalized: msg.charge_finalized ?? true,
                  chargeRateUsdPerHour:
                    msg.charge_rate_usd_per_hour ?? chargeRateUsdPerHour,
                  totalChargeUsd: msg.total_charge_usd ?? 0,
                  balanceDueUsd: msg.balance_due_usd ?? 0,
                  paid: msg.paid ?? false,
                  paymentStatus:
                    msg.payment_status ??
                    ((msg.charge_enabled ?? chargeEnabled)
                      ? "payment_due"
                      : "not_required"),
                }
              : prev,
          );
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
      setJobPhase("error");
      setJobPhaseDetail("The connection to the host closed unexpectedly.");
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
    setJobPhase("pending_approval");
    setJobPhaseDetail(null);
    setJobResult(null);
    setIsPayingForJob(false);
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

  const handleApproveRequest = async (
    requestId: string,
    chargeEnabled = false,
  ) => {
    try {
      await approveRequest(requestId, chargeEnabled);
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

  const handlePayForJob = async () => {
    if (!selectedWorker || !currentJob || !jobResult || !jobResult.chargeEnabled || jobResult.paid) {
      return;
    }

    try {
      setIsPayingForJob(true);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const payment = await payForJob(selectedWorker, currentJob.requestId);

      setJobResult((prev) =>
        prev
          ? {
              ...prev,
              chargeFinalized: true,
              paid: payment.paid,
              balanceDueUsd: payment.balance_due_usd,
              totalChargeUsd: payment.total_charge_usd ?? prev.totalChargeUsd,
              paymentStatus: payment.payment_status,
            }
          : prev,
      );
      setCurrentJob((prev) =>
        prev
          ? {
              ...prev,
              chargeFinalized: true,
              paid: payment.paid,
              balanceDueUsd: payment.balance_due_usd,
              totalChargeUsd: payment.total_charge_usd ?? prev.totalChargeUsd,
              paymentStatus: payment.payment_status,
            }
          : prev,
      );
    } catch (err) {
      console.error("Failed to pay for job:", err);
      alert("Failed to complete the demo payment.");
    } finally {
      setIsPayingForJob(false);
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
                phase={jobPhase}
                phaseDetail={jobPhaseDetail}
                chargeEnabled={currentJob.chargeEnabled ?? false}
                chargeRateUsdPerHour={currentJob.chargeRateUsdPerHour ?? 0}
                currentChargeUsd={computeDemoCharge(
                  currentJob.chargeEnabled ?? false,
                  currentJob.chargeRateUsdPerHour ?? 0,
                  elapsedTime,
                )}
                onReturn={handleReturnToWorkerList}
              />
            )}

            {stage === "complete" && selectedWorker && currentJob && (
              <JobCompleteScreen
                worker={selectedWorker}
                jobName={currentJob.name}
                result={jobResult}
                isPaying={isPayingForJob}
                onPay={handlePayForJob}
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
