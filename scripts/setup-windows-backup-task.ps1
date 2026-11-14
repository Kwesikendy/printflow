# PrintFlow Windows Automated Daily Backup Task Installer
# Run this PowerShell script as Administrator to register a Windows Scheduled Task
# that automatically backs up PrintFlow daily at 23:00 (11:00 PM).

$TaskName = "PrintFlow-Daily-Backup"
$ProjectDir = "d:\Printess\printflow"
$ActionCommand = "cmd.exe"
$ActionArguments = "/c cd /d `"$ProjectDir`" && npm run backup >> `"$ProjectDir\backups\scheduled_task.log`" 2>&1"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Registering PrintFlow Daily Automatic Backup Task" -ForegroundColor Cyan
Write-Host "  Task Name: $TaskName" -ForegroundColor Cyan
Write-Host "  Directory: $ProjectDir" -ForegroundColor Cyan
Write-Host "  Schedule:  Every day at 23:00 (11:00 PM)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "Existing task '$TaskName' found. Unregistering old version..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$Action = New-ScheduledTaskAction -Execute $ActionCommand -Argument $ActionArguments
$Trigger = New-ScheduledTaskTrigger -Daily -At "23:00"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Automated daily backup of PrintFlow database tables and Google Drive sync"

Write-Host "`n✓ Successfully registered scheduled task '$TaskName'!" -ForegroundColor Green
Write-Host "Backups will run automatically every night at 23:00." -ForegroundColor Green
Write-Host "Logs will be written to: $ProjectDir\backups\scheduled_task.log" -ForegroundColor Gray
