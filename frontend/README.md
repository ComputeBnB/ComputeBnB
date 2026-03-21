# ComputeBnB Desktop App

A polished desktop application for local-first compute sharing built with Tauri, React, TypeScript, and Tailwind CSS.

## Overview

ComputeBnB allows users to offload Python jobs to other trusted computers on the same local network. This implementation focuses on the frontend UI with mocked data and state transitions.

### Features

- **Discover Workers**: Browse and select available computers on your local network
- **Submit Jobs**: Configure and submit Python batch jobs to remote workers
- **Live Execution**: Watch your job execute in real-time with streaming logs
- **Results Review**: View completion status and download output artifacts

## Tech Stack

- **Tauri** - Desktop application framework
- **Vite** - Build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Clean icon library

## Project Structure

```
computebnb-gui/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── LogViewer.tsx    # Terminal-style log display
│   │   ├── ResultCard.tsx   # Output file cards
│   │   ├── StatusBadge.tsx  # Status indicators
│   │   └── WorkerCard.tsx   # Worker selection cards
│   ├── screens/             # Main application screens
│   │   ├── WorkerListScreen.tsx      # Stage 1: Discover workers
│   │   ├── SubmitJobScreen.tsx       # Stage 2: Submit job
│   │   ├── JobExecutionScreen.tsx    # Stage 3: Watch execution
│   │   └── JobCompleteScreen.tsx     # Stage 4: View results
│   ├── App.tsx              # Main app with state management
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles
│   ├── types.ts             # TypeScript type definitions
│   └── mockData.ts          # Mocked workers, logs, and results
├── src-tauri/               # Tauri backend (Rust)
│   ├── src/
│   │   └── main.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── tsconfig.json
```

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18 or later)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **npm** or **yarn**
   - Comes with Node.js
   - Verify: `npm --version`

3. **Rust** (for Tauri)
   - Install from [rustup.rs](https://rustup.rs/)
   - Verify: `rustc --version`

4. **System Dependencies** (platform-specific)

   **macOS:**
   ```bash
   xcode-select --install
   ```

   **Linux (Debian/Ubuntu):**
   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.0-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libgtk-3-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev
   ```

   **Windows:**
   - Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Tauri CLI (if not already installed):**
   ```bash
   npm install -g @tauri-apps/cli
   ```

## Development

Run the development server with hot-reload:

```bash
npm run tauri dev
```

This will:
- Start the Vite dev server on `http://localhost:1420`
- Launch the Tauri desktop window
- Enable hot-reload for both frontend and backend changes

### Development Tips

- The app opens on the Worker List screen by default
- Click any available worker to progress through the stages
- Logs stream automatically during execution (mocked with 1.5s intervals)
- The complete flow auto-transitions after all logs finish
- Click "Return to Worker List" to reset the app state

## Building for Production

Create optimized production builds:

```bash
npm run tauri build
```

This will create platform-specific installers in `src-tauri/target/release/bundle/`:
- **macOS**: `.dmg` and `.app`
- **Windows**: `.msi` and `.exe`
- **Linux**: `.deb`, `.AppImage`, etc.

## UI Stages & Flow

### 1. Discover Workers
The landing screen displays all available workers on the local network.

**Features:**
- Grid layout of worker cards
- Real-time status indicators (Available, Busy, Offline)
- Detailed specs: CPU, RAM, GPU
- Trusted worker badges
- Refresh functionality

### 2. Submit Job
Configure and submit a Python job to the selected worker.

**Features:**
- Selected worker summary panel
- Job name input
- Python script file selector
- Optional config file upload
- Command-line arguments field
- Notes/description textarea
- Capability hints and recommendations
- Back navigation

### 3. Job Execution
Watch the job run in real-time with streaming logs.

**Features:**
- Live execution status
- Elapsed time counter
- Progress indicator
- Terminal-style log viewer with auto-scroll
- Worker information display
- Smooth log streaming animation

### 4. Job Complete
Review results and download output artifacts.

**Features:**
- Success confirmation
- Total runtime display
- Result summary
- Downloadable output files with metadata
- Return to worker list action

## Customization

### Design Tokens

Edit `tailwind.config.js` to customize the color scheme:

```js
colors: {
  'app-bg': '#0a0a0b',           // Main background
  'app-surface': '#111113',       // Card backgrounds
  'app-accent': '#3b82f6',        // Primary accent
  'app-success': '#10b981',       // Success states
  // ... more tokens
}
```

### Mock Data

Modify `src/mockData.ts` to change:
- Available workers and their specs
- Execution log messages
- Job output files and results
- Timing intervals

### Animations

Adjust animation timing in `src/App.tsx`:
- Log streaming interval (currently 1.5s)
- Stage transition delays
- Timer update frequency

## Current Limitations

This is a **frontend-only implementation** with mocked interactions:

- Worker discovery is simulated (no real network scanning)
- File uploads are UI-only (no actual file handling)
- Job execution is mocked (no real Python execution)
- Logs are pre-scripted (no real stdout/stderr capture)
- Results are static (no real artifact generation)

## Next Steps for Backend Integration

When ready to add backend functionality:

1. **Worker Discovery**
   - Implement mDNS/Bonjour for local network discovery
   - Add worker health checks and capability reporting

2. **Job Submission**
   - Add file upload handling (Python scripts, configs)
   - Implement job queue and scheduling

3. **Execution**
   - Connect to worker nodes via SSH/gRPC
   - Stream real stdout/stderr logs
   - Handle job lifecycle (start, pause, cancel, retry)

4. **Results**
   - Implement artifact storage and retrieval
   - Add result download functionality
   - Support multiple output formats

5. **Tauri Backend Commands**
   - Add Rust commands in `src-tauri/src/main.rs`
   - Use Tauri IPC for frontend-backend communication
   - Implement secure credential storage

## Design Philosophy

The UI follows these principles:

- **Operational Clarity**: Clear status indicators and progress feedback
- **Systems Product Feel**: Refined, professional, infrastructure-grade
- **Intentional Motion**: Subtle animations that enhance UX
- **Information Density**: High clarity without clutter
- **Dark-First**: Optimized for extended use and focus

## Troubleshooting

**Vite dev server won't start:**
- Check if port 1420 is in use
- Try: `lsof -ti:1420 | xargs kill` (macOS/Linux)

**Tauri build fails:**
- Ensure Rust is up to date: `rustup update`
- Clear cargo cache: `cargo clean`

**Styles not applying:**
- Restart dev server
- Check Tailwind config paths
- Verify PostCSS is processing

**TypeScript errors:**
- Run: `npm install --save-dev @types/react @types/react-dom`
- Check `tsconfig.json` settings

## Contributing

This is a frontend scaffolding project. Future contributions could include:

- Additional worker filtering and sorting
- Job templates and presets
- Execution history and job management
- Performance monitoring and metrics
- Multi-job parallel execution UI
- Worker trust management interface

## License

MIT

---

**Note**: This is a UI prototype with mocked interactions. No actual compute jobs are executed.
