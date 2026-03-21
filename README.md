# ComputeBnb

ComputeBnb is a hackathon MVP for sharing idle computers on a local network as temporary execution nodes.

The demo lets one machine discover available worker machines on the same LAN, choose one, send a Python job, and receive live logs and final results back.

## MVP Goal

Build a cross-platform LAN demo where:

- worker machines advertise themselves automatically - each worker is called a `host`
- a client discovers available workers on the network - each client is called a `guest`
- the user selects a worker manually
- the client sends a Python job with a timeout
- the worker executes it and streams logs back in real time

## Scope

### Included

- LAN-only discovery
- mDNS-based worker discovery
- TCP connection for job execution and log streaming
- Python-only execution
- manual worker selection
- real-time stdout/stderr streaming
- timeout enforcement
- final job status reporting
- Docker-based Python execution
- cross-platform worker support for macOS, Windows, and Linux

### Excluded

- internet-wide discovery
- NAT traversal
- decentralized scheduling
- automatic "earliest accept wins" assignment
- billing, payments, reputation, or marketplace mechanics
- strong production-grade sandboxing

## Architecture

### Components

#### Host 

Runs the program of the `guest`.

Responsibilities:
- advertise itself on the LAN using mDNS
- expose a TCP server for job (program) execution
- manually accept one job
- run Python code
- stream logs and status updates back to the client
- enforce job timeout
- report idle or busy state

#### Guest

A lightweight web UI or local app used by the requester.

Responsibilities:
- discover workers on the LAN using mDNS
- show available workers in a list
- allow manual worker selection
- accept Python code input and timeout setting
- connect to the selected worker over TCP
- display live logs, metrics, and final status

#### Execution Layer

Runs user jobs on the worker.

Primary:
- Docker with a fixed Python image

Fallback:
- local subprocess execution in trusted-demo mode

## Network Design

### Discovery: mDNS

Hosts advertise a service such as:

`_compute-worker._tcp.local`

Each worker publishes metadata like:
- `worker_id`
- `ipv4`
- `display_name`
- `tcp_port`
- `status`
- `platform`

The client browses for this service and updates the available worker list automatically.

Why mDNS:
- zero-config LAN discovery
- cleaner than building custom UDP discovery logic
- simple user experience for a local network demo

### Connection: TCP

After the user selects a worker:
- the client opens a TCP connection to the worker
- the client sends a job payload
- the worker streams logs, metrics, and status over the same connection

Why TCP:
- reliable delivery
- simple request/response flow
- good fit for long-running streams

## Execution Model

### Python-Only Jobs

To keep the MVP small and reliable, the system supports Python only.

Recommended input:
- a single Python file as text

Optional later:
- a zipped Python project with `main.py`
- drag-and-drop folder upload with auto-zip in the UI

Entrypoint:
- `python main.py`

### Docker Runtime

Docker is part of the main MVP plan.

Recommended container image:
- `python:3.11-slim`

Worker flow:
- receive Python code over TCP
- write job files into a temporary working directory
- start a Docker container with that directory mounted
- run `python main.py`
- stream logs back to the client
- stop and clean up the container when the job finishes or times out

Recommended limits:
- one container per worker at a time
- CPU and memory caps if easy to add
- timeout enforced by the worker even if the container hangs
- disable networking later if time permits

### Timeout

Each job includes a user-selected timeout.

Rules:
- worker starts a timer when execution begins
- worker terminates the job when timeout is reached
- maximum timeout can be capped at 1 hour

### Output Streaming

The worker streams:
- `stdout`
- `stderr`
- status changes
- optional CPU and memory metrics

Final states:
- `done`
- `failed`
- `timeout`

## Security Approach

### Recommendation

Use Docker as the default execution path. Do not use VMs for this hackathon.

#### Docker

Pros:
- fixed Python environment
- better isolation than raw subprocesses
- easier resource limiting
- better demo story

Cons:
- requires Docker to be installed and running
- adds setup and integration work

#### VM

Cons:
- too heavy for an 8-hour build
- too much platform complexity
- slower startup
- not worth it for this MVP

#### Subprocess Fallback

If Docker fails on a demo machine or takes too long on one platform, use local subprocess execution as an emergency fallback.

This should be treated as trusted-demo mode only.

## Tech Stack

### Backend and Worker

Implement the worker agent and local control logic in Python.

Recommended pieces:
- `Python 3.11`
- `zeroconf` for mDNS discovery
- `socket` or `asyncio` for TCP communication
- `subprocess` for Docker execution and fallback local execution

Why Python:
- fastest to build in a hackathon
- simpler debugging and iteration
- matches the Python-only execution model
- easy Docker integration
- works across macOS, Windows, and Linux

### Client

Use a browser-based UI with plain HTML, CSS, and JavaScript.

Why:
- no frontend framework setup overhead
- no desktop packaging work
- easiest way to stay cross-platform
- fast to demo

### Container Runtime

Use Docker as the default execution environment.

Recommended image:
- `python:3.11-slim`

### Cross-Platform Plan

The system stays cross-platform by using:
- Python for the worker and backend logic
- browser UI for the client
- Docker for a consistent execution environment where available

If Docker is not available on a demo machine, the worker can fall back to local subprocess execution in trusted-demo mode.

## Protocol

Use newline-delimited JSON over TCP.

### Client to Worker

#### Run Job

```json
{ "type": "run", "job_id": "job-1", "filename": "main.py", "timeout_secs": 300, "code": "print('hi')" }
```

Initial MVP note:
- support `code` first
- treat zip project upload as a stretch goal

#### Cancel Job

```json
{ "type": "cancel", "job_id": "job-1" }
```

### Worker to Client

#### Status

```json
{ "type": "status", "state": "starting" }
```

#### Stdout

```json
{ "type": "stdout", "data": "hello\n" }
```

#### Stderr

```json
{ "type": "stderr", "data": "error\n" }
```

#### Metrics

```json
{ "type": "metrics", "cpu_pct": 12.3, "mem_mb": 48 }
```

#### Done

```json
{ "type": "done", "exit_code": 0, "duration_ms": 820 }
```

#### Error

```json
{ "type": "error", "message": "worker busy" }
```

## User Flow

1. Worker starts
2. Worker advertises itself via mDNS
3. Client opens and discovers workers on the LAN
4. User selects a worker
5. User pastes Python code or uploads a single file
6. User sets a timeout
7. Client sends the job over TCP
8. Worker starts a Docker container and executes the job
9. Client receives live logs and status updates
10. Job finishes or times out
11. Worker returns to idle

## Team Plan

### Developer 1: Worker Agent

- build TCP server
- implement job lifecycle
- enforce timeout
- stream logs

### Developer 2: Discovery and Protocol

- implement mDNS advertise and browse
- define JSON message schema
- handle client-worker connection flow

### Developer 3: Frontend

- build worker list UI
- build Python code submission UI
- show live logs
- show job status and timer

### Developer 4: Execution and Integration

- add Docker runner
- add subprocess fallback
- add metrics collection
- integrate and stabilize demo

## 8-Hour Plan

### Hour 1

- lock scope
- finalize protocol
- assign ownership

### Hour 2

- make workers advertise over mDNS
- make client discover workers

### Hour 3

- establish TCP connection from client to worker

### Hour 4

- execute a simple Python script in Docker
- return success or failure

### Hour 5

- stream stdout and stderr live
- enforce timeout

### Hour 6

- add metrics and status transitions
- handle busy and idle worker state

### Hour 7

- finalize Docker path and keep subprocess fallback ready
- test on multiple machines

### Hour 8

- polish UI
- fix demo bugs
- rehearse pitch and fallback demo flow

## Definition of Done

The MVP is done when:

- at least two workers appear automatically on the LAN
- the client can select a worker
- the user can submit a Python script
- the worker runs the script in Docker
- logs stream in real time
- timeout works correctly
- final state is shown cleanly
- the demo works on at least two machines

## Risks

- mDNS may behave differently across networks
- Docker setup may take too long
- Docker may not be installed or running on every machine
- live log streaming may be buggy
- Python runtime differences may affect subprocess fallback

## Mitigation

- keep manual IP connect as a backup
- verify Docker early on all worker machines
- keep subprocess execution as a fallback if Docker slips
- support only one job at a time per worker
- support only single-file Python scripts in the initial MVP
- test early on real machines

## Pitch

"ComputeBnb turns idle computers on a local network into temporary execution nodes. A worker machine advertises itself, a client discovers it, sends a Python job, and watches the logs stream back live."
