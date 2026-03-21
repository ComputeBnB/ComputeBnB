import { Worker } from './types';

export const mockWorkers: Worker[] = [
  {
    id: 'worker-1',
    name: 'MacBook Pro M2',
    status: 'available',
    trusted: true,
    specs: {
      cpu: 'Apple M2 Pro',
      cpuCores: 12,
      ram: '32 GB',
      gpu: 'Apple M2 Pro GPU (19-core)',
    },
    lastSeen: 'Just now',
  },
  {
    id: 'worker-2',
    name: 'Desktop-Workstation',
    status: 'available',
    trusted: true,
    specs: {
      cpu: 'AMD Ryzen 9 7950X',
      cpuCores: 16,
      ram: '64 GB',
      gpu: 'NVIDIA RTX 4090',
    },
    lastSeen: '2 minutes ago',
  },
  {
    id: 'worker-3',
    name: 'Home-Server',
    status: 'busy',
    trusted: true,
    specs: {
      cpu: 'Intel Xeon E5-2680 v4',
      cpuCores: 28,
      ram: '128 GB',
    },
    lastSeen: 'Just now',
  },
  {
    id: 'worker-4',
    name: 'Lab-Machine-04',
    status: 'available',
    trusted: false,
    specs: {
      cpu: 'Intel Core i9-13900K',
      cpuCores: 24,
      ram: '32 GB',
      gpu: 'NVIDIA RTX 3080',
    },
    lastSeen: '5 minutes ago',
  },
  {
    id: 'worker-5',
    name: 'Gaming-Rig',
    status: 'available',
    trusted: true,
    specs: {
      cpu: 'AMD Ryzen 7 7800X3D',
      cpuCores: 8,
      ram: '32 GB',
      gpu: 'NVIDIA RTX 4070 Ti',
    },
    lastSeen: '1 minute ago',
  },
];

export const mockLogs = [
  '[00:00] Job received and queued',
  '[00:01] Initializing Python environment',
  '[00:02] Loading dependencies: numpy, pandas, scikit-learn',
  '[00:05] Dependencies resolved successfully',
  '[00:06] Starting execution: training_pipeline.py',
  '[00:07] Loading dataset (125,000 rows)',
  '[00:10] Dataset loaded: 125,000 samples, 42 features',
  '[00:11] Preprocessing data...',
  '[00:14] Feature engineering complete',
  '[00:15] Splitting dataset: 80% train, 20% validation',
  '[00:16] Training Random Forest model (n_estimators=500)',
  '[00:18] Epoch 1/5 - Training accuracy: 0.7234',
  '[00:22] Epoch 2/5 - Training accuracy: 0.8012',
  '[00:26] Epoch 3/5 - Training accuracy: 0.8456',
  '[00:31] Epoch 4/5 - Training accuracy: 0.8723',
  '[00:35] Epoch 5/5 - Training accuracy: 0.8891',
  '[00:36] Model training complete',
  '[00:37] Evaluating on validation set...',
  '[00:38] Validation accuracy: 0.8634',
  '[00:39] Generating feature importance plots',
  '[00:41] Saving model checkpoint: model_v1.pkl',
  '[00:42] Saving performance metrics: metrics.json',
  '[00:43] Generating prediction report',
  '[00:45] Cleaning up temporary files',
  '[00:46] Job completed successfully',
];

export const mockJobResult = {
  exitCode: 0,
  runtime: 46.3,
  outputFiles: [
    { name: 'model_v1.pkl', size: '234 MB', type: 'Model' },
    { name: 'metrics.json', size: '12 KB', type: 'Metrics' },
    { name: 'feature_importance.png', size: '856 KB', type: 'Visualization' },
    { name: 'prediction_report.csv', size: '4.2 MB', type: 'Results' },
  ],
  summary: 'Model training completed with 86.34% validation accuracy. Feature importance analysis and prediction reports generated successfully.',
};
