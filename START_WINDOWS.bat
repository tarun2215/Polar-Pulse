@echo off
setlocal
cd /d "%~dp0"
title POLAR PULSE - Local mission engine
if not exist ".venv\Scripts\python.exe" (
    echo First run SETUP_WINDOWS.bat in this folder.
    echo Then run START_WINDOWS.bat again.
    pause
    exit /b 1
)
echo.
echo POLAR PULSE is starting. Keep this window open during the demo.
echo Your browser will open when the server is ready.
echo Stop with Ctrl+C. This is a simulated research demonstration only.
echo.
".venv\Scripts\python.exe" start.py %*
if errorlevel 1 (
    echo.
    echo The local engine stopped. Read the message above.
    echo If port 8000 is occupied, run: START_WINDOWS.bat --port 8001
    pause
)
