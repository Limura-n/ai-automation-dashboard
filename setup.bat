@echo off
title Adobe Stock Mission Control Setup
cd /d "%~dp0"

echo.
echo ============================================
echo   Adobe Stock Mission Control — Setup
echo ============================================
echo.

REM Auto-detect: if PowerShell is available, use setup.ps1
where powershell >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [i] PowerShell detected — running setup.ps1
    echo.
    powershell -ExecutionPolicy Bypass -File "setup.ps1"
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [^!] Setup exited with error code %ERRORLEVEL%
        echo     Check the output above for details.
        pause
    )
    goto :eof
)

REM Fallback: try node
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [i] Node.js detected but PowerShell not found.
    echo [i] Please run this from PowerShell for the full setup:
    echo     powershell -ExecutionPolicy Bypass -File setup.ps1
    echo.
    pause
    goto :eof
)

echo [✗] Neither PowerShell nor Node.js found!
echo     Please install Node.js from https://nodejs.org
echo     Then run this script again.
echo.
pause
