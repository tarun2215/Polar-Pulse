@echo off
setlocal
cd /d "%~dp0"
title POLAR PULSE - First-time setup
color 0B
echo.
echo =============================================================
echo    POLAR PULSE - First-time setup
 echo    Internet is needed for this package installation only.
echo =============================================================
echo.
set "PY_CMD="
where py >nul 2>nul
if not errorlevel 1 (
    for %%V in (3.13 3.12 3.11) do (
        if not defined PY_CMD (
            py -%%V -c "import sys; sys.exit(0)" >nul 2>nul
            if not errorlevel 1 set "PY_CMD=py -%%V"
        )
    )
)
if not defined PY_CMD (
    python -c "import sys; sys.exit(0 if (3,11) <= sys.version_info[:2] <= (3,13) else 1)" >nul 2>nul
    if not errorlevel 1 set "PY_CMD=python"
)
if not defined PY_CMD (
    echo Python 3.11, 3.12, or 3.13 was not found.
    echo Install 64-bit Python from https://www.python.org/downloads/windows/
    echo Enable "Add python.exe to PATH" during installation.
    echo Then close this window and run SETUP_WINDOWS.bat again.
    pause
    exit /b 1
)
echo Using %PY_CMD%
if not exist ".venv\Scripts\python.exe" (
    %PY_CMD% -m venv .venv
    if errorlevel 1 goto :failed
)
echo Installing the local runtime packages...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :failed
".venv\Scripts\python.exe" -c "import fastapi,uvicorn,numpy,shapely,pyproj; print('All runtime imports passed.')"
if errorlevel 1 goto :failed
echo.
echo Setup complete. Double-click START_WINDOWS.bat next.
echo No Node.js, Docker, map token, or AI API key is required.
echo Keep the project extracted; do not run it from inside the ZIP.
echo.
pause
exit /b 0
:failed
echo.
echo Setup did not finish. Check the error above and your internet connection.
echo Try again; do not delete or disable your security software.
echo See docs\quick-start.md for troubleshooting.
pause
exit /b 1
