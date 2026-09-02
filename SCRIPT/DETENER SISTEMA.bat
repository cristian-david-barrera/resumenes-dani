@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Proyecto Daniela - DETENER SISTEMA

cd /d "%~dp0.."
set "ROOT=%CD%"

echo.
echo ============================================
echo   PROYECTO DANIELA - DETENER SISTEMA
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_servicios.ps1" -Accion detener -Root "%ROOT%"

echo.
echo Listo. El sistema fue detenido.
echo (PostgreSQL queda corriendo como servicio de Windows.)
echo.
pause
exit /b 0
