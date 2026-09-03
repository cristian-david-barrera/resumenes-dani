@echo off
setlocal EnableExtensions
title Daniela DETENER SISTEMA

for %%I in ("%~dp0.") do set "SCRIPTDIR=%%~fI"
for %%I in ("%SCRIPTDIR%\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

echo.
echo ============================================
echo   PROYECTO DANIELA - DETENER SISTEMA
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTDIR%\_servicios.ps1" -Accion detener -Root "%ROOT%"

echo.
echo Listo. El sistema fue detenido.
echo (PostgreSQL queda corriendo como servicio de Windows.)
echo.
pause
exit /b 0
