@echo off
REM ===========================================================================
REM  EduTrack - one-click launcher (production mode)
REM
REM  Does everything a fresh machine needs: installs dependencies, creates
REM  configuration with generated secrets, migrates the database, loads demo
REM  data the first time, builds, then opens the browser when the server is
REM  actually serving.
REM
REM  Safe to run repeatedly. Nothing here overwrites existing data or config.
REM  For development with hot reload, use dev-edutrack.bat instead.
REM ===========================================================================

title EduTrack
cd /d "%~dp0"

echo.
echo  ============================================
echo    EduTrack - starting up
echo  ============================================
echo.

REM --- Node.js -------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo  [X] Node.js is not installed.
    echo.
    echo      EduTrack needs Node.js 20 or newer.
    echo      Download it from https://nodejs.org and run this file again.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo  [OK] Node.js %NODE_VERSION%

REM --- Dependencies --------------------------------------------------------
REM Checked via .package-lock.json rather than the folder itself: an install
REM interrupted halfway leaves node_modules present but unusable.
if not exist "node_modules\.package-lock.json" (
    echo.
    echo  [..] Installing dependencies. First run only - takes a few minutes.
    echo.
    call npm install
    if errorlevel 1 goto :install_failed
) else (
    echo  [OK] Dependencies installed
)

REM --- Configuration, database, demo data ----------------------------------
echo.
call node scripts\bootstrap.mjs
if errorlevel 1 goto :setup_failed

REM --- Build ---------------------------------------------------------------
echo.
echo  [..] Building the application
call npm run build
if errorlevel 1 goto :build_failed

REM --- Launch --------------------------------------------------------------
echo.
echo  ============================================
echo    EduTrack is starting at
echo      http://localhost:3000
echo.
echo    Demo sign-in ^(password: demo-password-123^)
echo      Owner    priya@brightminds.in
echo      Teacher  rao@brightminds.in
echo      Parent   anita.sharma@example.in
echo.
echo    Close this window to stop the server.
echo  ============================================
echo.

REM Opens the browser only once the server responds.
start /b "" node scripts\open-when-ready.mjs http://localhost:3000

call npm start

REM npm start only returns when the server stops.
echo.
echo  EduTrack has stopped.
pause
exit /b 0

REM --- Failure paths -------------------------------------------------------
:install_failed
echo.
echo  [X] Could not install dependencies.
echo      Check your internet connection and run this file again.
echo.
pause
exit /b 1

:setup_failed
echo.
echo  [X] Database setup failed. The message above says why.
echo.
pause
exit /b 1

:build_failed
echo.
echo  [X] Build failed. The message above says why.
echo.
pause
exit /b 1
