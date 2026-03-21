# AGENTS.md

This file gives contributors and coding agents a shared operating guide for `ComputeBnb`.

## Project Goal

Build a hackathon MVP that lets a `guest` machine discover `host` machines on the same LAN, select one manually, send a Python job, execute it in Docker, and receive live logs and final status back.

## Product Boundaries

Keep the MVP small.

In scope:
- LAN-only discovery
- mDNS service advertisement and browsing
- TCP connection for job transport and streaming
- Python-only jobs
- Docker-first execution
- local subprocess fallback if Docker is unavailable
- one active job per host
- live stdout and stderr streaming
- timeout enforcement

Out of scope unless explicitly requested:
- internet-wide discovery
- NAT traversal
- billing or marketplace features
- reputation systems
- decentralized scheduling
- multiple concurrent jobs per host
- production-grade sandboxing

## Preferred Stack

- `Python 3.11`
- `zeroconf` for mDNS
- `asyncio` or `socket` for TCP
- `subprocess` for Docker and fallback execution
- plain `HTML/CSS/JS` for the UI
- Docker image: `python:3.11-slim`

## Terminology

- `host`: machine offering compute
- `guest`: machine submitting a job
- `job`: Python program plus timeout and metadata

Use these terms consistently in code, docs, and UI.

## Architecture Rules

- Prefer direct host-to-guest connections after discovery; do not add a central coordinator for the MVP.
- Use mDNS only for discovery, not job transport.
- Use TCP for reliable job submission and log streaming.
- Keep the protocol simple: newline-delimited JSON.
- Make Docker the primary execution path.
- Keep subprocess execution as a fallback path, clearly labeled trusted-demo mode.

## Protocol Guardrails

Minimum message types:
- `run`
- `cancel`
- `status`
- `stdout`
- `stderr`
- `metrics`
- `done`
- `error`

Prefer additive protocol changes over breaking schema changes.

## Execution Rules

- Initial MVP should support single-file Python jobs first.
- Zip project upload is a stretch goal, not a dependency for the first demo.
- Require a `timeout_secs` on every run request.
- Kill Docker containers or subprocesses on timeout.
- Clean up temp files and containers after completion.
- Do not promise strong isolation; document it as a hackathon MVP.

## UX Priorities

- Hosts should appear automatically on the LAN.
- Guests should be able to pick a host manually.
- Live logs should be visible quickly and clearly.
- Failures should surface as explicit states, not silent disconnects.
- Include a simple fallback path if mDNS fails, such as manual IP entry.

## Coding Priorities

- Optimize for speed of implementation and debuggability.
- Keep modules small and obvious.
- Prefer simple functions and standard library tools.
- Add comments only when behavior is not obvious.
- Avoid premature abstractions.

## Validation Checklist

Before merging or demoing changes, verify:
- at least one host advertises over mDNS
- at least one guest can discover hosts
- TCP connection succeeds to a selected host
- a Python job runs in Docker
- stdout and stderr stream back live
- timeout kills the job correctly
- host returns to idle after job completion

## Common Mistakes To Avoid

- adding zip upload before single-file execution works
- making protocol changes without updating README
- mixing host/guest terminology with worker/client terminology
- assuming Docker exists on every demo machine
- making the UI depend on framework tooling unless clearly needed
- adding VM support

## Documentation Rule

If implementation changes the protocol, runtime assumptions, or MVP scope, update `README.md` in the same change.
