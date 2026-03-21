@echo off
cd /d "%~dp0"

:: Create venv if it doesn't exist
if not exist ".venv" (
    echo Creating virtual environment...
    %PYTHON% -m venv .venv
)

:: Activate and install
call .venv\Scripts\activate.bat
pip install -e . --quiet

:: Run
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
