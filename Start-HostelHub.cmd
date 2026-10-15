@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-HostelHub.ps1" %*
set "HOSTEL_HUB_EXIT=%ERRORLEVEL%"

if not "%HOSTEL_HUB_EXIT%"=="0" (
  echo.
  echo Hostel Hub could not start. Review the error shown above.
  pause
)

exit /b %HOSTEL_HUB_EXIT%
