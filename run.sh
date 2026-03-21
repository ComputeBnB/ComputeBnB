#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== ComputeBnB ==="
echo ""

# ── Backend ──────────────────────────────────────────────────────────

echo "[1/2] Setting up backend..."
cd backend

REQUIRED_PYTHON="python3.11"
if ! command -v $REQUIRED_PYTHON &> /dev/null; then
    # Fall back to python3 if 3.11 isn't specifically available
    if command -v python3 &> /dev/null; then
        REQUIRED_PYTHON="python3"
        echo "  Using $(python3 --version)"
    else
        echo "Error: Python 3.11+ is required but not installed."
        exit 1
    fi
fi

if [ ! -d ".venv" ]; then
    echo "  Creating virtual environment..."
    $REQUIRED_PYTHON -m venv .venv
fi

source .venv/bin/activate
pip install -e . --quiet
echo "  Backend ready."

# Start backend in background
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend running (PID $BACKEND_PID)"

cd ..

# ── Frontend ─────────────────────────────────────────────────────────

echo ""
echo "[2/2] Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm install --silent
fi

echo "  Starting frontend dev server..."
npm run dev &
FRONTEND_PID=$!
echo "  Frontend running (PID $FRONTEND_PID)"

cd ..

# ── Wait ─────────────────────────────────────────────────────────────

echo ""
echo "=== Both services running ==="
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:1420"
echo ""
echo "Press Ctrl+C to stop both."

# Trap Ctrl+C to kill both processes
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
