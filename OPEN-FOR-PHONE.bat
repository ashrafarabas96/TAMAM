@echo off
REM ===================================================================
REM  TAMAM - let phones on your Wi-Fi reach the system
REM
REM  Windows blocks incoming connections to Docker's ports by default, so
REM  a phone that types this computer's address gets nothing back. This
REM  opens ports 3000 (the app) and 3001 (the console) on every network
REM  profile and then prints the address to type into the app.
REM  Run it once; the rule stays.
REM ===================================================================
setlocal
cd /d "%~dp0"
title TAMAM - open for phones

REM --- Firewall rules need administrator rights: ask for them once. ---
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Windows will now ask for permission to change the firewall.
  echo   Click "Yes" in the window that appears.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo   ==========================================
echo      TAMAM - open for phones
echo   ==========================================
echo.

echo   [1/3] Allowing phones to reach ports 3000 and 3001...
netsh advfirewall firewall delete rule name="TAMAM API (3000)" >nul 2>&1
netsh advfirewall firewall add rule name="TAMAM API (3000)" dir=in action=allow protocol=TCP localport=3000 profile=any >nul
if errorlevel 1 (
  echo   [X] Could not add the firewall rule. Send a photo of this window for help.
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="TAMAM Console (3001)" >nul 2>&1
netsh advfirewall firewall add rule name="TAMAM Console (3001)" dir=in action=allow protocol=TCP localport=3001 profile=any >nul
echo         Done.
echo.

echo   [2/3] Is TAMAM running on this computer?
curl -s -o nul http://localhost:3000/health/live 2>nul
if errorlevel 1 (
  echo   [X] Not running. Double-click START-WINDOWS.bat, wait for
  echo       "TAMAM is running", then try the phone again.
) else (
  echo         Yes.
)
echo.

echo   [3/3] This computer's addresses on the network:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback|Docker|Hyper-V|VirtualBox|VMware|Bluetooth' } | Sort-Object InterfaceMetric | ForEach-Object { '           ' + $_.IPAddress + '    (' + $_.InterfaceAlias + ')' }"
echo.
echo   In the app, type the Wi-Fi address (usually 192.168.x.x).
echo   Not sure it works? Open this in the phone's browser first:
echo         http://ADDRESS:3000/health/live
echo   It should show   {"status":"ok", ...}
echo.
echo   Still nothing?
echo     - Phone and computer must be on the SAME Wi-Fi: not mobile data,
echo       not a guest network, not a hotspot from the phone itself.
echo     - Some routers stop phones from talking to computers
echo       ("AP isolation" or "client isolation") - turn that off.
echo     - Make sure Docker Desktop is running and TAMAM is started.
echo.
pause
