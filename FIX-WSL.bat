@echo off
REM ===================================================================
REM  TAMAM - enable WSL 2 so Docker can start
REM
REM  Docker Desktop runs inside WSL 2. When WSL reports
REM     "virtualization is not enabled on this machine"
REM  the Virtual Machine Platform Windows component is switched off,
REM  and no amount of restarting Docker will help.
REM
REM  Turning it on needs administrator rights, so this file asks
REM  Windows for them itself instead of making the user find
REM  PowerShell and right-click it.
REM ===================================================================
setlocal
cd /d "%~dp0"
title TAMAM - enable WSL 2

REM --- re-launch elevated if we are not already ------------------------
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Windows will now ask for permission. Click YES.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" >nul 2>&1
  if errorlevel 1 (
    echo   [X] Could not ask for administrator rights.
    echo       Right-click this file and choose 'Run as administrator'.
    echo.
    pause
  )
  exit /b 0
)

echo.
echo   ==========================================
echo      TAMAM - enabling WSL 2
echo   ==========================================
echo.
echo   Running: wsl.exe --install --no-distribution
echo   This may take a few minutes. Do not close this window.
echo.

wsl.exe --install --no-distribution
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo   ==========================================
  echo   [X] Windows refused, exit code %RC%.
  echo.
  echo   That almost always means the switch is off in the BIOS,
  echo   not in Windows. To turn it on:
  echo.
  echo   1. Restart the computer.
  echo   2. Press F10 repeatedly while it starts. F10 is the BIOS
  echo      key on HP laptops. Other brands use F2, F12 or Del.
  echo   3. Under Advanced or System Configuration, find
  echo      Virtualization Technology, or SVM Mode, or VT-x.
  echo   4. Set it to Enabled.
  echo   5. Save and exit, usually with F10.
  echo   6. Run this file again.
  echo.
  pause
  exit /b 1
)

echo   ==========================================
echo   [OK] Done. WSL 2 is enabled.
echo.
echo   The computer MUST restart now for it to take effect.
echo   After it starts up again:
echo.
echo     1. Open Docker Desktop and wait for 'Engine running'.
echo     2. Double-click START-WINDOWS.bat
echo.
choice /C RL /N /M "  Press R to restart now, or L to close and restart later: "
if errorlevel 2 goto :later

echo.
echo   Restarting in 20 seconds. Save any open work now.
echo   To cancel, close this window and run:  shutdown /a
shutdown /r /t 20 /c "TAMAM: restarting to finish enabling WSL 2"
exit /b 0

:later
echo.
echo   Remember: nothing changes until you restart the computer.
echo.
pause
exit /b 0
