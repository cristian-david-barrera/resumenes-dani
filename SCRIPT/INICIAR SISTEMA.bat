@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Proyecto Daniela - INICIAR SISTEMA

cd /d "%~dp0.."
set "ROOT=%CD%"
set "BACKEND_URL=http://localhost:3001"
set "FRONTEND_URL=http://localhost:5173"
call "%~dp0_entorno.bat"

echo.
echo ============================================
echo   PROYECTO DANIELA - INICIAR SISTEMA
echo ============================================
echo.
echo Carpeta del proyecto:
echo   %ROOT%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js.
  echo Ejecuta primero "ACTUALIZAR SISTEMA.bat" o instala Node.js 20+.
  goto :fin_error
)

if not exist "%ROOT%\backend\.env" (
  echo [ERROR] Falta backend\.env
  echo Ejecuta primero "ACTUALIZAR SISTEMA.bat"
  goto :fin_error
)

if not exist "%ROOT%\backend\node_modules\" (
  echo [AVISO] Faltan dependencias. Ejecutando actualizacion...
  call "%~dp0ACTUALIZAR SISTEMA.bat"
  if errorlevel 1 goto :fin_error
)

if not exist "%ROOT%\backend\dist\index.js" (
  echo Compilando backend...
  pushd "%ROOT%\backend"
  call npm run build
  if errorlevel 1 (
    popd
    echo [ERROR] No se pudo compilar el backend
    goto :fin_error
  )
  popd
)

if not exist "%ROOT%\frontend\dist\index.html" (
  echo Compilando frontend...
  pushd "%ROOT%\frontend"
  call npm run build
  if errorlevel 1 (
    popd
    echo [ERROR] No se pudo compilar el frontend
    goto :fin_error
  )
  popd
)

echo [1/3] Iniciando PostgreSQL...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_postgres.ps1" -Accion iniciar
echo.

echo [2/3] Iniciando API y pantalla en segundo plano (sin ventanas)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_servicios.ps1" -Accion iniciar -Root "%ROOT%"
if errorlevel 1 (
  echo [ERROR] No se pudieron iniciar los servicios.
  goto :fin_error
)
echo.

echo [3/3] Esperando a que levanten los servicios...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_servicios.ps1" -Accion esperar -Root "%ROOT%"

echo Abriendo el navegador en %FRONTEND_URL%
start "" "%FRONTEND_URL%"

echo.
echo ============================================
echo   SISTEMA EN MARCHA
echo ============================================
echo.
echo   Pantalla:  %FRONTEND_URL%
echo   API:       %BACKEND_URL%
echo   Salud API: %BACKEND_URL%/api/health
echo   Salud DB:  %BACKEND_URL%/api/db-health
echo.
echo Backend y frontend corren ocultos (sin ventanas negras).
echo Para apagar todo: doble clic en "DETENER SISTEMA.bat"
echo.
echo Si algo falla, mira los logs en SCRIPT\logs\
echo.
exit /b 0

:fin_error
echo.
echo El sistema no pudo iniciarse. Revisá los mensajes de arriba.
echo.
pause
exit /b 1
