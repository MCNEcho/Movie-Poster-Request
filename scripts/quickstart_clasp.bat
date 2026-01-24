@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Quickstart bootstrap for deploying Apps Script via clasp
REM Requires Node.js, npm, and Google clasp

echo Checking Node.js and npm...
where node >nul 2>nul || (
  echo Node.js not found. Please install Node.js from https://nodejs.org/
  goto :end
)
where npm >nul 2>nul || (
  echo npm not found. Please install npm (bundled with Node.js).
  goto :end
)

REM Check clasp availability
where clasp >nul 2>nul || (
  echo Installing Google clasp CLI globally...
  npm install -g @google/clasp
  if ERRORLEVEL 1 (
    echo Failed to install clasp. Please install manually: npm install -g @google/clasp
    goto :end
  )
)

echo Logging into clasp (a browser window may open)...
clasp login
if ERRORLEVEL 1 (
  echo clasp login failed. Please run "clasp login" manually and re-run this script.
  goto :end
)

echo.
echo Choose an option:
echo   1) Create new Apps Script project bound to a new Google Sheet
echo   2) Clone existing Apps Script project by Script ID
set /p choice=Enter choice (1 or 2): 

if "%choice%"=="1" goto :create
if "%choice%"=="2" goto :clone

echo Invalid choice.
goto :end

:create
set /p title=Enter Sheet title (default: Poster Request System): 
if "%title%"=="" set title=Poster Request System

echo Creating new bound Sheets project: %title%
clasp create --type sheets --title "%title%"
if ERRORLEVEL 1 (
  echo Failed to create project. Aborting.
  goto :end
)

echo Pushing local code to Apps Script...
clasp push
if ERRORLEVEL 1 (
  echo clasp push failed. Please fix errors and re-run.
  goto :end
)

echo Done. Open the new Sheet, refresh, then run "Poster System -> Run Setup / Repair".
goto :end

:clone
set /p sid=Enter existing Apps Script Script ID: 
if "%sid%"=="" (
  echo Script ID is required.
  goto :end
)

echo Cloning Apps Script project %sid% ...
clasp clone %sid%
if ERRORLEVEL 1 (
  echo Failed to clone project. Check the Script ID and try again.
  goto :end
)

echo Pushing local code to Apps Script...
clasp push
if ERRORLEVEL 1 (
  echo clasp push failed. Please fix errors and re-run.
  goto :end
)

echo Done. Open the bound Sheet, refresh, then run "Poster System -> Run Setup / Repair".

echo.
:end
endlocal
