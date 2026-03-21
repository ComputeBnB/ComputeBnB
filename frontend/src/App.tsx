import { useState, useEffect } from "react";
import { AppStage, AppMode, Worker, Job } from "./types";
import { mockWorkers, mockLogs, mockJobResult } from "./mockData";
import { WorkerListScreen } from "./screens/WorkerListScreen";
import { SubmitJobScreen } from "./screens/SubmitJobScreen";
import { JobExecutionScreen } from "./screens/JobExecutionScreen";
import { JobCompleteScreen } from "./screens/JobCompleteScreen";
import { HostModeScreen } from "./screens/HostModeScreen";

function App() {
  const [mode, setMode] = useState<AppMode>("guest");
  const [stage, setStage] = useState<AppStage>("discover");
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Simulate log streaming during execution
  useEffect(() => {
    if (stage === "execution" && executionLogs.length < mockLogs.length) {
      const timer = setTimeout(() => {
        setExecutionLogs((prev) => [...prev, mockLogs[prev.length]]);
      }, 1500); // Add a new log every 1.5 seconds

      return () => clearTimeout(timer);
    }

    // When all logs are complete, transition to complete screen
    if (stage === "execution" && executionLogs.length === mockLogs.length) {
      const completeTimer = setTimeout(() => {
        setStage("complete");
      }, 2000);

      return () => clearTimeout(completeTimer);
    }
  }, [stage, executionLogs.length]);

  // Simulate elapsed time counter during execution
  useEffect(() => {
    if (stage === "execution") {
      const timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [stage]);

  const handleSelectWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setStage("submit");
  };

  const handleBackToWorkerList = () => {
    setStage("discover");
    setSelectedWorker(null);
  };

  const handleSubmitJob = (jobData: {
    name: string;
    pythonFile: string;
    configFile?: string;
    arguments?: string;
    notes?: string;
  }) => {
    if (!selectedWorker) return;

    const job: Job = {
      id: `job-${Date.now()}`,
      name: jobData.name,
      worker: selectedWorker,
      pythonFile: jobData.pythonFile,
      configFile: jobData.configFile,
      arguments: jobData.arguments,
      notes: jobData.notes,
      status: "running",
      startTime: new Date(),
      logs: [],
    };

    setCurrentJob(job);
    setExecutionLogs([]);
    setElapsedTime(0);
    setStage("execution");
  };

  const handleReturnToWorkerList = () => {
    setStage("discover");
    setSelectedWorker(null);
    setCurrentJob(null);
    setExecutionLogs([]);
    setElapsedTime(0);
  };

  const handleStartHosting = () => {
    setMode("host");
    setStage("discover");
    setSelectedWorker(null);
    setCurrentJob(null);
  };

  const handleStopHosting = () => {
    setMode("guest");
    setStage("discover");
  };

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
          <HostModeScreen onStopHosting={handleStopHosting} />
        ) : (
          <>
            {stage === "discover" && (
              <WorkerListScreen
                workers={mockWorkers}
                onSelectWorker={handleSelectWorker}
                onStartHosting={handleStartHosting}
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
              />
            )}

            {stage === "complete" && selectedWorker && currentJob && (
              <JobCompleteScreen
                worker={selectedWorker}
                jobName={currentJob.name}
                result={mockJobResult}
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
