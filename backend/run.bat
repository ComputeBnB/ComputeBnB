@echo off
cd /d "%~dp0"

:: Create venv if it doesn't exist
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

:: Activate and install
call .venv\Scripts\activate.bat
pip install -e . --quiet

:: Run main app or CLI
echo.
echo Select mode:
echo   1. Run API server (default)
echo   2. Run ComputeBnB CLI
set /p mode="Enter choice [1/2]: "
if "%mode%"=="2" (
    python cli.py
) else (
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
)
