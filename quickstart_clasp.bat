@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Always keep window open + create a log
set "LOG=%~dp0setup_clasp_log.txt"
echo.>"%LOG%"
call :LOG "=== START %date% %time% ==="
call :LOG "Script path: %~f0"
call :LOG "Script dir : %~dp0"
call :LOG "User       : %USERNAME%"
call :LOG "OS         : %OS%"
call :LOG "PATH       : %PATH%"

title Clasp Setup + Push (Debug)

echo.
echo [INFO] Writing log to:
echo   %LOG%
echo.

REM -----------------------------
REM 1) Verify Node.js + npm
REM -----------------------------
call :LOG "Checking node..."
where node >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH.
  call :LOG "[ERROR] node not found"
  goto :END_FAIL
)

call :LOG "Checking npm..."
where npm >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found in PATH.
  call :LOG "[ERROR] npm not found"
  goto :END_FAIL
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
for /f "delims=" %%v in ('npm -v 2^>nul') do set "NPM_VER=%%v"
echo [OK] Node: !NODE_VER!
echo [OK] npm : !NPM_VER!
call :LOG "[OK] Node !NODE_VER! / npm !NPM_VER!"

REM -----------------------------
REM 2) Verify clasp (install if missing)
REM -----------------------------
call :LOG "Checking clasp..."
where clasp >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [WARN] clasp not found. Installing globally...
  call :LOG "[WARN] clasp not found; installing: npm install -g @google/clasp"
  call npm install -g @google/clasp >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Failed to install @google/clasp. See log.
    call :LOG "[ERROR] npm install -g @google/clasp failed"
    goto :END_FAIL
  )
)

where clasp >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] clasp still not found after install. See log.
  call :LOG "[ERROR] clasp not found after install"
  goto :END_FAIL
)

for /f "delims=" %%v in ('clasp -v 2^>nul') do set "CLASP_VER=%%v"
echo [OK] clasp: !CLASP_VER!
call :LOG "[OK] clasp !CLASP_VER!"

REM -----------------------------
REM 3) clasp login
REM -----------------------------
echo.
echo [INFO] Logging into clasp (browser may open)...
call :LOG "Running: clasp login"
call clasp login >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [WARN] clasp login failed. Trying --no-localhost...
  call :LOG "[WARN] clasp login failed; trying --no-localhost"
  call clasp login --no-localhost >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] clasp login failed again. See log.
    call :LOG "[ERROR] clasp login failed again"
    goto :END_FAIL
  )
)
echo [OK] Logged in.
call :LOG "[OK] Logged in"

REM -----------------------------
REM 4) Move into main folder
REM -----------------------------
echo.
echo [INFO] Locating main folder...
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_DIR=%%~fI"
set "MAIN_DIR=%REPO_DIR%\main"
call :LOG "Computed MAIN_DIR: %MAIN_DIR%"

if not exist "%MAIN_DIR%\" (
  echo [WARN] Expected main folder not found:
  echo        "%MAIN_DIR%"
  echo.
  echo Paste full path to your "main" folder:
  set /p "MAIN_DIR=Main folder path: "
  call :LOG "User provided MAIN_DIR: %MAIN_DIR%"
)

if not exist "%MAIN_DIR%\" (
  echo [ERROR] Main folder still doesn't exist:
  echo        "%MAIN_DIR%"
  call :LOG "[ERROR] MAIN_DIR does not exist"
  goto :END_FAIL
)

pushd "%MAIN_DIR%" >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] Could not cd into:
  echo        "%MAIN_DIR%"
  call :LOG "[ERROR] pushd failed"
  goto :END_FAIL
)

echo [OK] Working dir:
cd
call :LOG "[OK] Working dir: %CD%"

REM -----------------------------
REM 5) Script ID + .clasp.json
REM -----------------------------
echo.
echo [INFO] Find Script ID:
echo  1) Open Apps Script project
echo  2) Gear icon (Project Settings)
echo  3) Copy Script ID
echo.
set /p "SCRIPT_ID=Paste Script ID here: "
set "SCRIPT_ID=%SCRIPT_ID:"=%"

if "%SCRIPT_ID%"=="" (
  echo [ERROR] Script ID was empty.
  call :LOG "[ERROR] Script ID empty"
  goto :END_FAIL
)

call :LOG "Writing .clasp.json with scriptId=%SCRIPT_ID%"
> ".clasp.json" (
  echo {^"scriptId^":^"%SCRIPT_ID%^",^"rootDir^":^".^"}
)

if not exist ".clasp.json" (
  echo [ERROR] Failed to create .clasp.json
  call :LOG "[ERROR] .clasp.json not created"
  goto :END_FAIL
)

echo [OK] .clasp.json created.
call :LOG "[OK] .clasp.json created"

REM -----------------------------
REM 6) Push prompt (FORCED PUSH + better output handling)
REM -----------------------------
echo.
choice /C YN /N /M "Push files to Script? (Y/N): "
if errorlevel 2 (
  echo [INFO] Push skipped.
  call :LOG "[INFO] Push skipped"
  goto :END_OK
)

echo.
echo [INFO] Running clasp push -f...
call :LOG "Running: clasp push -f"

set "OUT=%TEMP%\clasp_push_out.txt"
del "%OUT%" >nul 2>&1

call clasp push -f > "%OUT%" 2>&1
type "%OUT%" >>"%LOG%"
type "%OUT%"

if errorlevel 1 (
  echo [ERROR] clasp push failed. See log.
  call :LOG "[ERROR] clasp push failed"
  goto :END_FAIL
)

findstr /C:"Skipping push." "%OUT%" >nul
if not errorlevel 1 (
  echo [INFO] clasp skipped push (no changes detected). Nothing uploaded.
  call :LOG "[INFO] Skipping push detected"
  goto :END_OK
)

findstr /C:"Pushed " "%OUT%" >nul
if errorlevel 1 (
  echo [WARN] Push finished but did not show "Pushed X files."
  echo        Check the log: %LOG%
  call :LOG "[WARN] No 'Pushed X files' line detected"
) else (
  echo [OK] Push complete!
  call :LOG "[OK] Push complete"
)

REM Optional: open the script you just pushed to (your clasp supports this)
call :LOG "Running: clasp open-script"
call clasp open-script >>"%LOG%" 2>&1

goto :END_OK

:END_OK
call :LOG "=== END OK %date% %time% ==="
echo.
echo Done. Log saved to:
echo   %LOG%
echo.
popd >nul 2>&1
pause
exit /b 0

:END_FAIL
call :LOG "=== END FAIL %date% %time% ==="
echo.
echo Failed. Open the log:
echo   %LOG%
echo.
popd >nul 2>&1
pause
exit /b 1

:LOG
>>"%LOG%" echo %*
exit /b 0
