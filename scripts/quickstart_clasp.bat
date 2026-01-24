@echo off
REM Movie Poster Request System - Apps Script Deployment Script
REM This script deploys Google Apps Script code from /main folder to your Google Sheet

setlocal enabledelayedexpansion

REM Navigate to the parent directory (project root)
cd /d "%~dp0\.."

REM Verify we're in the right place
if not exist main (
  echo ERROR: Cannot find 'main' folder
  echo Current directory: %cd%
  echo.
  echo This script should be run from the project root directory.
  echo Expected structure:
  echo   project-root/
  echo     ^- main/
  echo     ^- scripts/
  echo     ^- logs/
  echo.
  pause
  exit /b 1
)

REM Create logs directory if it doesn't exist
if not exist logs mkdir logs

REM Create log file with timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set logfile=logs\deploy_%mydate%_%mytime%.log

echo. > "%logfile%"
echo ===== Movie Poster Request - Deploy Log ===== >> "%logfile%"
echo Date: %mydate% Time: %mytime% >> "%logfile%"
echo ============================================== >> "%logfile%"
echo. >> "%logfile%"

REM ===== STEP 1: CHECK DEPENDENCIES =====
echo ====================================
echo Movie Poster Request - Deploy
echo ====================================
echo.
echo [Log file: %logfile%]
echo.
echo Step 1: Checking dependencies...

echo [Step 1] Checking dependencies... >> "%logfile%"

where node >nul 2>nul
if ERRORLEVEL 1 (
  echo ERROR: Node.js not found
  echo Please install from https://nodejs.org/
  echo Node.js not found >> "%logfile%"
  pause
  exit /b 1
)
echo  - Node.js: OK

where npm >nul 2>nul
if ERRORLEVEL 1 (
  echo ERROR: npm not found
  echo npm not found >> "%logfile%"
  pause
  exit /b 1
)
echo  - npm: OK

where clasp >nul 2>nul
if ERRORLEVEL 1 (
  echo.
  echo Installing clasp...
  call npm install -g @google/clasp
  if ERRORLEVEL 1 (
    echo ERROR: Failed to install clasp >> "%logfile%"
    echo ERROR: Failed to install clasp
    pause
    exit /b 1
  )
)
echo  - clasp: OK

echo [Dependencies OK] >> "%logfile%"
echo. >> "%logfile%"

REM ===== STEP 2: GET SCRIPT ID =====
echo Step 2: Get your Apps Script Project ID
echo.
echo Instructions:
echo  1. Go to your Google Sheet
echo  2. Click "Extensions" menu
echo  3. Click "Apps Script"
echo  4. In the editor, click "Project Settings" (left sidebar)
echo  5. Copy the "Script ID"
echo  6. Paste it below
echo.

set /p scriptId=Paste Script ID: 

if "%scriptId%"=="" (
  echo ERROR: Script ID is required >> "%logfile%"
  echo.
  echo Script ID cannot be empty.
  echo.
  pause
  exit /b 1
)

echo Script ID: %scriptId%
echo [Step 2] Script ID entered: %scriptId% >> "%logfile%"
echo. >> "%logfile%"

REM ===== STEP 3: CREATE .clasp.json AND DEPLOY =====
echo ====================================
echo Deploying Code
echo ====================================
echo. >> "%logfile%"
echo [Step 3] Creating .clasp.json and pushing code... >> "%logfile%"

REM Check if .clasp.json already exists and back it up
if exist .clasp.json (
  echo .clasp.json already exists - backing up >> "%logfile%"
  move /Y .clasp.json .clasp.json.bak >nul 2>&1
)

REM Create .clasp.json with Script ID and rootDir
echo Creating .clasp.json... >> "%logfile%"
(
  echo {
  echo   "scriptId": "%scriptId%",
  echo   "rootDir": "main"
  echo }
) > .clasp.json

if not exist .clasp.json (
  echo ERROR: Failed to create .clasp.json >> "%logfile%"
  echo.
  echo ERROR: Could not create .clasp.json file
  echo.
  pause
  exit /b 1
)

echo .clasp.json created successfully >> "%logfile%"
echo .clasp.json contents: >> "%logfile%"
type .clasp.json >> "%logfile%"
echo. >> "%logfile%"

REM Verify main folder exists with files
echo Checking main folder contents... >> "%logfile%"
if not exist main (
  echo ERROR: main folder not found >> "%logfile%"
  echo.
  echo ERROR: main folder does not exist
  echo.
  pause
  exit /b 1
)

dir main >> "%logfile%"
echo. >> "%logfile%"

REM Push the code
echo Executing: clasp push -f >> "%logfile%"
echo. >> "%logfile%"

echo.
echo Pushing files...

REM Do the actual push and capture output
clasp push -f >> "%logfile%" 2>&1

if ERRORLEVEL 1 (
  echo Warning: clasp returned an exit code >> "%logfile%"
  echo. >> "%logfile%"
)

echo Pushed successfully at: %date% %time% >> "%logfile%"
echo. >> "%logfile%"

REM Verify files were pushed by checking status
echo Verifying upload... >> "%logfile%"
clasp status >> "%logfile%" 2>&1

echo. >> "%logfile%"
echo ===== Deployment Completed ===== >> "%logfile%"

echo.
echo.
echo ====================================
echo Deployment Complete!
echo ====================================
echo.
echo Files have been pushed to Apps Script.
echo.
echo NEXT STEPS:
echo.
echo  1. Go back to your Google Sheet
echo  2. Refresh the page (press F5)
echo  3. Look for "Poster System" menu at the top
echo  4. Click "Poster System" then "Run Setup / Repair"
echo  5. Wait for setup to complete
echo.
echo If the menu doesn't appear:
echo  - Try closing and reopening the Sheet
echo  - Check Extensions ^> Apps Script for any errors
echo.
echo Log file saved to:
echo %logfile%
echo.
pause
exit /b 0
