@echo off
REM ===========================================================================
REM  EduTrack - development launcher (hot reload)
REM
REM  Same setup as start-edutrack.bat, but runs the dev server so code changes
REM  appear without a rebuild. Pages compile on first visit, so the very first
REM  page load is slower than production mode.
REM
REM  Use start-edutrack.bat if you just want to USE the app.
REM ===========================================================================

title EduTrack (development)
cd /d "%~dp0"

echo.
echo  ============================================
echo    EduTrack - development mode
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo  [X] Node.js is not installed. Get it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\.package-lock.json" (
    echo  [..] Installing dependencies. First run only.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [X] Could not install dependencies.
        pause
        exit /b 1
    )
)

echo.
call node scripts\bootstrap.mjs
if errorlevel 1 (
    echo.
    echo  [X] Database setup failed. The message above says why.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo    Dev server starting at http://localhost:3000
echo    Close this window to stop it.
echo  ============================================
echo.

REM Dev compiles the first page on demand, so allow a longer wait.
start /b "" node scripts\open-when-ready.mjs http://localhost:3000 300000

call npm run dev

echo.
echo  EduTrack has stopped.
pause
exit /b 0
