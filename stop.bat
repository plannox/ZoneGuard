@echo off
echo Stopping Zone Guard (backend on port 8000, frontend on port 5174, event simulator) ...

rem the processes that listen on the two ports
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') DO (
    taskkill /F /PID %%a >nul 2>&1
)
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr /R /C:":5174 .*LISTENING"') DO (
    taskkill /F /PID %%a >nul 2>&1
)

rem the simulator (it has no port) and the console windows start.bat opened, found by their command line
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'tools.run_simulator\.py|uvicorn main:app --host 127\.0\.0\.1 --port 8000|npm run dev' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo Done. MongoDB is not stopped.
