@echo off
REM ===================================================================
REM  TAMAM - Docker doctor
REM
REM  Double-click this file when Docker will not start.
REM  It checks every requirement one by one, tells you exactly which
REM  one failed and how to fix it, and saves the result to
REM  docker-report.txt next to this file so you can send it for help.
REM
REM  Messages are in English on purpose: the Windows console cannot
REM  display Arabic reliably. The Arabic explanation is in the guide.
REM ===================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
title TAMAM - Docker check
set "REPORT=%~dp0docker-report.txt"
set "PROBLEM="
set "SYSINFO=%TEMP%\tamam-systeminfo.txt"
set "WSLOUT=%TEMP%\tamam-wsl.txt"

> "%REPORT%" echo TAMAM Docker report - %DATE% %TIME%
call :say ""
call :say "  =========================================="
call :say "     TAMAM - checking Docker"
call :say "  =========================================="
call :say ""
call :say "  This takes about a minute. Please wait."
call :say ""

REM --- 0. Windows edition and build ----------------------------------
call :say "  [1/6] Windows version"
>>"%REPORT%" echo.
>>"%REPORT%" echo --- windows ---
ver >>"%REPORT%" 2>&1
REM systeminfo is slow, so it runs once here and every later check reads the file.
systeminfo > "%SYSINFO%" 2>nul
findstr /B /C:"OS Name" /C:"OS Version" "%SYSINFO%" >>"%REPORT%" 2>&1
for /f "tokens=2 delims=:" %%A in ('findstr /B /C:"OS Name" "%SYSINFO%" 2^>nul') do (
  set "OSNAME=%%A"
)
if defined OSNAME call :say "        !OSNAME:~1!"

REM --- 1. Is Docker installed? ---------------------------------------
call :say ""
call :say "  [2/6] Is Docker Desktop installed?"
>>"%REPORT%" echo.
>>"%REPORT%" echo --- where docker ---
where docker >>"%REPORT%" 2>&1
if errorlevel 1 (
  call :say "        NO - Docker Desktop is not installed."
  set "PROBLEM=NOT_INSTALLED"
  goto :verdict
)
call :say "        Yes."
>>"%REPORT%" echo.
>>"%REPORT%" echo --- docker version ---
docker version >>"%REPORT%" 2>&1

REM --- 2. Does the engine answer? -------------------------------------
call :say ""
call :say "  [3/6] Is the Docker engine running?"
>>"%REPORT%" echo.
>>"%REPORT%" echo --- docker info ---
docker info >>"%REPORT%" 2>&1
if not errorlevel 1 (
  call :say "        Yes - Docker is fully working."
  set "PROBLEM=NONE"
  goto :verdict
)
call :say "        NO - the engine did not answer."

REM --- 3. Is the Docker Desktop app even open? ------------------------
call :say ""
call :say "  [4/6] Is the Docker Desktop app open?"
>>"%REPORT%" echo.
>>"%REPORT%" echo --- tasklist ---
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>nul | find /I "Docker Desktop.exe" >nul
if errorlevel 1 (
  call :say "        NO - the app is closed."
  set "PROBLEM=NOT_RUNNING"
) else (
  call :say "        Yes - the app is open but the engine is not ready."
  set "PROBLEM=ENGINE_STUCK"
)
tasklist /FI "IMAGENAME eq Docker Desktop.exe" >>"%REPORT%" 2>&1

REM --- 4. Virtualization in the BIOS ----------------------------------
call :say ""
call :say "  [5/6] Is virtualization enabled in the BIOS?"
>>"%REPORT%" echo.
>>"%REPORT%" echo --- virtualization ---
findstr /C:"Virtualization Enabled In Firmware" /C:"A hypervisor has been detected" "%SYSINFO%" >>"%REPORT%" 2>&1
findstr /C:"A hypervisor has been detected" "%SYSINFO%" >nul 2>&1
if not errorlevel 1 (
  call :say "        A hypervisor is running - but see the WSL check below."
) else (
  findstr /C:"Virtualization Enabled In Firmware: Yes" "%SYSINFO%" >nul 2>&1
  if not errorlevel 1 (
    call :say "        Yes."
  ) else (
    findstr /C:"Virtualization Enabled In Firmware: No" "%SYSINFO%" >nul 2>&1
    if not errorlevel 1 (
      call :say "        NO - this is the problem. It must be turned on in the BIOS."
      set "PROBLEM=NO_VIRTUALIZATION"
    ) else (
      call :say "        Could not tell - see docker-report.txt."
    )
  )
)

REM --- 5. WSL 2 -------------------------------------------------------
REM wsl.exe prints UTF-16, which findstr cannot search and which lands in the
REM report as one letter per two bytes. PowerShell re-encodes it to plain text
REM so both this script and a human can read what WSL actually said.
call :say ""
call :say "  [6/6] Is WSL 2 working?"
>>"%REPORT%" echo.
>>"%REPORT%" echo --- wsl ---
where wsl >nul 2>&1
if errorlevel 1 (
  call :say "        NO - WSL is missing. Docker Desktop needs it."
  if not "!PROBLEM!"=="NO_VIRTUALIZATION" set "PROBLEM=NO_WSL"
  goto :verdict
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$e=[Console]::OutputEncoding; [Console]::OutputEncoding=[Text.Encoding]::Unicode; $o=(& wsl.exe --status 2>&1 | Out-String) + (& wsl.exe --list --verbose 2>&1 | Out-String); [Console]::OutputEncoding=$e; $o" > "%WSLOUT%" 2>&1
if not exist "%WSLOUT%" wsl --status > "%WSLOUT%" 2>&1
type "%WSLOUT%" >>"%REPORT%" 2>&1

findstr /I /C:"virtualization is not enabled" "%WSLOUT%" >nul 2>&1
if not errorlevel 1 (
  call :say "        NO - WSL says virtualization is not enabled."
  call :say "        This is the real cause. It blocks the Docker engine."
  set "PROBLEM=WSL_NO_VIRT"
  goto :verdict
)
findstr /I /C:"has no installed distributions" "%WSLOUT%" >nul 2>&1
if not errorlevel 1 (
  call :say "        WSL runs but has no Linux installed."
  set "PROBLEM=WSL_NO_DISTRO"
  goto :verdict
)
call :say "        WSL looks fine - details are in docker-report.txt."

:verdict
call :say ""
call :say "  =========================================="
call :say "     RESULT"
call :say "  =========================================="
call :say ""

if "%PROBLEM%"=="NONE" (
  call :say "  Docker is working. Nothing to fix."
  call :say ""
  call :say "  Next step: double-click START-WINDOWS.bat"
  goto :done
)

if "%PROBLEM%"=="NOT_INSTALLED" (
  call :say "  Docker Desktop is not installed."
  call :say ""
  call :say "  1. Open:  https://www.docker.com/products/docker-desktop"
  call :say "  2. Download 'Docker Desktop for Windows - AMD64'."
  call :say "  3. Run the installer. Keep 'Use WSL 2' ticked."
  call :say "  4. RESTART the computer - this step is not optional."
  call :say "  5. Open Docker Desktop, accept the terms, wait for"
  call :say "     'Engine running' at the bottom left."
  call :say "  6. Run this file again."
  goto :done
)

if "%PROBLEM%"=="NOT_RUNNING" (
  call :say "  Docker Desktop is installed but closed."
  call :say ""
  call :say "  1. Press the Windows key, type: Docker Desktop"
  call :say "  2. Open it and wait 1-3 minutes."
  call :say "  3. The bottom left must say 'Engine running' in green."
  call :say "  4. Run this file again."
  goto :done
)

if "%PROBLEM%"=="ENGINE_STUCK" (
  call :say "  Docker Desktop is open but the engine never started."
  call :say ""
  call :say "  Do these in order, testing after each one:"
  call :say "  1. Right-click the whale icon near the clock, then"
  call :say "     choose Quit Docker Desktop. Open it again, wait 3 minutes."
  call :say "  2. Open PowerShell as Administrator and run:"
  call :say "        wsl --update"
  call :say "        wsl --shutdown"
  call :say "     then open Docker Desktop again."
  call :say "  3. In Docker Desktop: gear icon, then Troubleshoot, then"
  call :say "     'Reset to factory defaults'."
  call :say "  4. Restart the computer."
  goto :done
)

if "%PROBLEM%"=="NO_VIRTUALIZATION" (
  call :say "  Virtualization is switched off in the BIOS."
  call :say "  Docker cannot run at all until it is on."
  call :say ""
  call :say "  1. Restart the computer."
  call :say "  2. While it starts, press F10 repeatedly on HP laptops."
  call :say "     Other brands: F2, F12 or Del."
  call :say "  3. Find: Virtualization Technology / SVM Mode / VT-x"
  call :say "     usually under Advanced or System Configuration."
  call :say "  4. Set it to Enabled."
  call :say "  5. Save and exit - usually F10."
  call :say "  6. Open Docker Desktop, then run this file again."
  goto :done
)

if "%PROBLEM%"=="WSL_NO_VIRT" (
  call :say "  WSL 2 cannot start because virtualization is off."
  call :say "  Docker Desktop runs inside WSL 2, so nothing works until"
  call :say "  this is fixed. Do all four steps, in this order:"
  call :say ""
  call :say "  1. Press the Windows key, type: PowerShell"
  call :say "     Right-click it and choose 'Run as administrator'."
  call :say "  2. Run this line and let it finish:"
  call :say "        wsl.exe --install --no-distribution"
  call :say "  3. RESTART the computer."
  call :say "  4. Open Docker Desktop and wait for 'Engine running'."
  call :say ""
  call :say "  If step 2 reports the same error again, the switch is off"
  call :say "  in the BIOS. Restart, press F10 while it boots on an HP,"
  call :say "  find Virtualization Technology or SVM Mode under Advanced,"
  call :say "  set it to Enabled, save and exit."
  goto :done
)

if "%PROBLEM%"=="WSL_NO_DISTRO" (
  call :say "  WSL 2 works but has no Linux installed."
  call :say ""
  call :say "  1. Open PowerShell as administrator."
  call :say "  2. Run:  wsl --install -d Ubuntu"
  call :say "  3. RESTART the computer."
  call :say "  4. Open Docker Desktop and wait for 'Engine running'."
  goto :done
)

if "%PROBLEM%"=="NO_WSL" (
  call :say "  WSL 2 is missing. Docker Desktop is built on top of it."
  call :say ""
  call :say "  1. Press the Windows key, type: PowerShell"
  call :say "  2. Right-click it and choose 'Run as administrator'."
  call :say "  3. Type this and press Enter:"
  call :say "        wsl --install"
  call :say "  4. RESTART the computer."
  call :say "  5. Open Docker Desktop, then run this file again."
  goto :done
)

call :say "  The checks did not point at one clear cause."
call :say "  Send docker-report.txt for help."

:done
del "%SYSINFO%" >nul 2>&1
del "%WSLOUT%" >nul 2>&1
call :say ""
call :say "  A full report was saved to:"
call :say "    %REPORT%"
call :say ""
echo   Press any key to close this window.
pause >nul
exit /b 0

:say
set "LINE=%~1"
if not defined LINE (
  echo.
  >>"%REPORT%" echo.
  goto :eof
)
echo !LINE!
>>"%REPORT%" echo !LINE!
goto :eof
