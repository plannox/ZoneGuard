@echo off
setlocal
cd /d "%~dp0"

rem start.bat already starts the simulator. Use this file to run it again by hand
rem (for example after stopping it with Ctrl+C or closing its window).

if not exist backend\venv\Scripts\python.exe (
    echo ERROR: backend is not set up. Run setup.bat first.
    exit /b 1
)

netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if errorlevel 1 (
    echo ERROR: the Zone Guard backend is not running on port 8000. Run start.bat first.
    exit /b 1
)

echo Zone Guard event simulator  (stop it with Ctrl+C)
echo.
cd backend
.\venv\Scripts\python.exe tools\run_simulator.py
endlocal
