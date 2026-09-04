@echo off
REM ===================================================================
REM  TAMAM — تشغيل النظام كاملاً
REM
REM  Double-click this file. It checks Docker is running, builds the
REM  platform the first time, and opens the admin console when ready.
REM
REM  The first run takes 10-20 minutes because it downloads and builds
REM  everything. Every run after that takes about a minute.
REM ===================================================================
setlocal
cd /d "%~dp0"
title TAMAM

echo.
echo   ==========================================
echo      TAMAM - Starting the platform
echo   ==========================================
echo.

REM --- Is Docker installed? ------------------------------------------
where docker >nul 2>&1
if errorlevel 1 (
  echo   [X] Docker Desktop is not installed.
  echo.
  echo       Install it from:  https://www.docker.com/products/docker-desktop
  echo       Then restart your computer and double-click this file again.
  echo.
  pause
  exit /b 1
)

REM --- Is Docker actually running? -----------------------------------
docker info >nul 2>&1
if errorlevel 1 (
  echo   [X] Docker Desktop is installed but not running.
  echo.
  echo       Open Docker Desktop from the Start menu, wait until it says
  echo       "Engine running", then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo   [1/3] Docker is ready.
echo.
echo   [2/3] Building and starting TAMAM...
echo         The first time this takes 10-20 minutes. Please leave this
echo         window open - you can watch the progress below.
echo.

docker compose -f infrastructure\docker\docker-compose.yml up -d --build
if errorlevel 1 (
  echo.
  echo   [X] Something went wrong while starting.
  echo       Copy the messages above and send them for help.
  echo.
  pause
  exit /b 1
)

echo.
echo   [3/3] Waiting for the system to be ready...

REM The API seeds the database on first boot, so the console is not
REM useful until it reports healthy. 180 tries x 5s = up to 15 minutes.
set /a tries=0
:wait
set /a tries+=1
curl -s -o nul http://localhost:3000/health/live 2>nul
if not errorlevel 1 goto ready
if %tries% geq 180 (
  echo.
  echo   [X] The system did not become ready in time.
  echo       Run this to see what happened:
  echo         docker compose -f infrastructure\docker\docker-compose.yml logs api
  echo.
  pause
  exit /b 1
)
timeout /t 5 /nobreak >nul
goto wait

:ready
echo.
echo   ==========================================
echo      TAMAM is running
echo   ==========================================
echo.
echo     Admin console :  http://localhost:3001
echo     Email         :  admin@tamam.app
echo     Password      :  TamamAdmin#2026
echo.
echo     API           :  http://localhost:3000
echo     File storage  :  http://localhost:9001  (tamam / tamam-secret)
echo.
echo     To stop it later, double-click STOP-WINDOWS.bat
echo.

start "" http://localhost:3001

echo   You can close this window now.
pause
