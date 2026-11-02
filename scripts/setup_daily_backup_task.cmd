@echo off
echo ========================================================
echo  PrintFlow - Register Daily Backup in Windows Task Scheduler
echo  Scheduled Time: 17:00 (5:00 PM Africa/Accra shift boundary)
echo ========================================================

set SCRIPT_PATH=%~dp0run-backup.mjs

schtasks /create /tn "PrintFlow-Daily-Backup" /tr "node \"%SCRIPT_PATH%\"" /sc daily /st 17:00 /f

if %ERRORLEVEL% equ 0 (
  echo.
  echo [SUCCESS] Windows Task "PrintFlow-Daily-Backup" registered successfully!
  echo It will run automatically every day at 17:00.
) else (
  echo.
  echo [NOTE] If this failed, please right click this file and select "Run as administrator".
)

pause
