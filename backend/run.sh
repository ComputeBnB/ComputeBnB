#!/bin/bash
set -e

cd "$(dirname "$0")"

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment"
    python3 -m venv .venv
fi

# Activate and install
source .venv/bin/activate
pip install -e . --quiet

# Run main app or CLI
echo
echo "Select mode:"
echo "  1. Run API server (default)"
echo "  2. Run ComputeBnB CLI"
read -p "Enter choice [1/2]: " mode
if [ "$mode" = "2" ]; then
    python cli.py
else
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi
