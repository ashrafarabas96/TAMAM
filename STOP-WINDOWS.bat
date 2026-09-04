@echo off
REM Stops TAMAM. Your data is kept - starting again brings it all back.
setlocal
cd /d "%~dp0"
title TAMAM - stopping

echo.
echo   Stopping TAMAM...
docker compose -f infrastructure\docker\docker-compose.yml down
echo.
echo   Stopped. Your data is safe - double-click START-WINDOWS.bat to
echo   start again.
echo.
pause
