#!/bin/bash
set -e

cd "$(dirname "$0")"

find_python() {
    for candidate in python3.11 python3.12 python3; do
        if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)'; then
            echo "$candidate"
            return 0
        fi
    done

    echo "Error: Python 3.11 or newer is required." >&2
    echo "Install Python 3.11+ and rerun ./run.sh." >&2
    exit 1
}

PYTHON_BIN=$(find_python)

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment"
    "$PYTHON_BIN" -m venv .venv
elif ! .venv/bin/python -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
    echo "Recreating virtual environment with $PYTHON_BIN"
    rm -rf .venv
    "$PYTHON_BIN" -m venv .venv
fi

# Activate and install
source .venv/bin/activate
pip install -e . --quiet

# Run API server
echo
echo "Starting API server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
