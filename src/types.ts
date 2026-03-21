export interface Worker {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  trusted: boolean;
  specs: {
    cpu: string;
    cpuCores: number;
    ram: string;
    gpu?: string;
  };
  lastSeen: string;
}

export interface Job {
  id: string;
  name: string;
  worker: Worker;
  pythonFile: string;
  configFile?: string;
  arguments?: string;
  notes?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  result?: JobResult;
}

export interface JobResult {
  exitCode: number;
  runtime: number;
  outputFiles: {
    name: string;
    size: string;
    type: string;
  }[];
  summary: string;
}

export type AppStage = 'discover' | 'submit' | 'execution' | 'complete';
