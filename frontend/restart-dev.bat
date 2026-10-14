@echo off
echo ========================================================
echo   MANTO 2.0 - Purga de Cache y Reinicio de Next.js :3002
echo ========================================================

powershell.exe -ExecutionPolicy Bypass -File "%~dp0restart-dev.ps1"
