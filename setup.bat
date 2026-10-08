@echo off
rem ============================================================================
rem  Zone Guard setup launcher
rem   1. reads the PowerShell execution policy of the current user
rem   2. sets it to Bypass for the duration of the setup
rem   3. runs setup\setup.ps1 (checks requirements, offers to install what is missing)
rem   4. restores the previous execution policy
rem  Options are passed on:  setup.bat -CheckOnly | -AssumeYes | -DryRun
rem ============================================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Zone Guard Setup

if not exist "%~dp0setup\setup.ps1" (
    echo ERROR: setup\setup.ps1 was not found next to setup.bat.
    exit /b 1
)

rem Setting a policy can report "updated successfully, but overridden by a more specific scope".
rem The value IS stored in that case, so that specific error counts as success.
set "ZG_SET=try { Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy"

rem --- 1. check the execution policy ---------------------------------------------------
set "ZG_OLD_POLICY="
set "ZG_EFFECTIVE="
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "Get-ExecutionPolicy -Scope CurrentUser"`) do set "ZG_OLD_POLICY=%%p"
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "Get-ExecutionPolicy"`) do set "ZG_EFFECTIVE=%%p"
if not defined ZG_OLD_POLICY set "ZG_OLD_POLICY=Undefined"

echo.
echo  [ Zone Guard setup ]
echo  PowerShell execution policy:  current user = !ZG_OLD_POLICY!   effective = !ZG_EFFECTIVE!

rem --- 2. set it to Bypass (current user only, restored at the end) -------------------------
set "ZG_CHANGED=0"
if /i "!ZG_OLD_POLICY!"=="Bypass" (
    echo  Already Bypass for the current user - nothing to change.
) else (
    echo  Setting it to Bypass for the current user until the setup has finished ...
    powershell -NoProfile -Command "!ZG_SET! Bypass -Force -ErrorAction Stop; exit 0 } catch { if ($_.FullyQualifiedErrorId -like 'ExecutionPolicyOverride*') { exit 0 }; Write-Host ('  Could not change it: ' + $_.Exception.Message); exit 1 }"
    if errorlevel 1 (
        echo  Continuing anyway: the setup script is started with a process-level Bypass.
    ) else (
        set "ZG_CHANGED=1"
        echo  If this window is closed before the end, restore it with:
        echo     powershell -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy !ZG_OLD_POLICY! -Force"
    )
)
echo.

rem --- 3. run the setup script --------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\setup.ps1" %*
set "ZG_EXIT=!errorlevel!"

rem --- 4. restore the previous policy --------------------------------------------------------
if "!ZG_CHANGED!"=="1" (
    powershell -NoProfile -Command "!ZG_SET! !ZG_OLD_POLICY! -Force -ErrorAction Stop; exit 0 } catch { if ($_.FullyQualifiedErrorId -like 'ExecutionPolicyOverride*') { exit 0 }; Write-Host ('  Could not restore it: ' + $_.Exception.Message); exit 1 }"
    set "ZG_NOW="
    for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "Get-ExecutionPolicy -Scope CurrentUser"`) do set "ZG_NOW=%%p"
    if /i "!ZG_NOW!"=="!ZG_OLD_POLICY!" (
        echo  Execution policy restored to !ZG_OLD_POLICY!.
    ) else (
        echo  WARNING: the execution policy is now !ZG_NOW!, it was !ZG_OLD_POLICY!. Restore it with:
        echo     powershell -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy !ZG_OLD_POLICY! -Force"
    )
)
echo.

rem --- 5. setup.ps1 deletes its own folder after a fully successful setup (not after a failure,
rem     -CheckOnly or -DryRun). When that happened, this launcher removes itself as well.
set "ZG_CLEAN=0"
if "!ZG_EXIT!"=="0" if not exist "%~dp0setup\setup.ps1" set "ZG_CLEAN=1"
pause
if "!ZG_CLEAN!"=="1" (
    rem a batch file can delete itself: the failing "goto" ends the script, then del runs
    (goto) 2>nul & del "%~f0" & exit /b %ZG_EXIT%
)
endlocal & exit /b %ZG_EXIT%
