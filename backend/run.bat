@echo off
cd /d "%~dp0"

:: Check if python3.11 is available, fall back to python
where python3.11 >nul 2>nul
if %ERRORLEVEL%==0 (
    set PYTHON=python3.11
) else (
    where python >nul 2>nul
    if %ERRORLEVEL%==0 (
        set PYTHON=python
    ) else (
        echo Error: Python is not installed or not in PATH.
        echo Please install Python 3.11 to run this project.
        exit /b 1
    )
)

:: Verify Python version is 3.11
for /f "tokens=2 delims= " %%v in ('%PYTHON% --version 2^>^&1') do set PYVER=%%v
echo Found Python %PYVER%
echo %PYVER% | findstr /b "3.11" >nul
if %ERRORLEVEL% neq 0 (
    echo Warning: Python 3.11 is recommended. Found %PYVER%.
)

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
