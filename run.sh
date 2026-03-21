#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel --quiet
python -m pip install . --quiet

if command -v npm >/dev/null 2>&1; then
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install >/dev/null
    fi
    echo "Building frontend..."
    npm run build >/dev/null
fi

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
