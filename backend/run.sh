#!/bin/bash
set -e

cd "$(dirname "$0")"

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment with Python 3.11..."
    $REQUIRED_PYTHON -m venv .venv
fi

# Activate and install
source .venv/bin/activate
pip install -e . --quiet

# Run
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
