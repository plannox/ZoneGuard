@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Zone Guard - start

if not exist backend\venv\Scripts\python.exe (
    echo ERROR: backend is not set up. Run setup.bat first.
    pause
    exit /b 1
)
if not exist frontend\node_modules (
    echo ERROR: frontend is not set up. Run setup.bat first.
    pause
    exit /b 1
)

netstat -ano | findstr /R /C:":27017 .*LISTENING" >nul
if errorlevel 1 (
    echo WARNING: nothing is listening on port 27017. Zone Guard needs MongoDB; start it first.
    echo.
)

echo [1/4] Preparing the database ...
pushd backend
.\venv\Scripts\python.exe tools\prepare_database.py
if errorlevel 1 (
    popd
    echo ERROR: the database could not be prepared. See the message above.
    pause
    exit /b 1
)
popd
echo.

echo [2/4] Starting the backend on http://127.0.0.1:8000 ...
start "Zone Guard Backend" /d "%~dp0backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo [3/4] Starting the frontend on http://localhost:5174 ...
start "Zone Guard Frontend" /d "%~dp0frontend" cmd /k "npm run dev"

echo [4/4] Waiting for the backend, then starting the event simulator ...
set /a ZG_TRIES=0
:waitbackend
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if not errorlevel 1 goto backendup
set /a ZG_TRIES+=1
if %ZG_TRIES% GEQ 45 goto backenddown
ping -n 2 127.0.0.1 >nul
goto waitbackend

:backenddown
echo WARNING: the backend did not start within 45 seconds - the simulator was not started.
echo          Look at the "Zone Guard Backend" window for the reason (is MongoDB running?).
goto opened

:backendup
start "Zone Guard Simulator" /d "%~dp0backend" cmd /k ".\venv\Scripts\python.exe tools\run_simulator.py"
echo          (the simulator needs zones: load the demo data or add zones in Settings)

:opened
start http://localhost:5174

echo.
echo ============================================================================
echo  Zone Guard is starting.   Application:  http://localhost:5174
echo  Stop everything with stop.bat.
echo.
echo  Generated logins (copy what you need; this list is also saved in
echo  backend\data\accounts.txt):
echo ============================================================================
pushd backend
.\venv\Scripts\python.exe tools\prepare_database.py --show
popd
echo.
echo  The admin password above is the INITIAL one: you must change it at the first
echo  login, after that this list shows a password that no longer works.
echo.
pause
endlocal
