@echo off
setlocal EnableExtensions
title Daniela VERIFICAR REQUISITOS

for %%I in ("%~dp0.") do set "SCRIPTDIR=%%~fI"
for %%I in ("%SCRIPTDIR%\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"
call "%SCRIPTDIR%\_entorno.bat"

set "OK=1"

echo.
echo ============================================
echo   PROYECTO DANIELA - VERIFICAR REQUISITOS
echo ============================================
echo.
echo Carpeta del proyecto:
echo   %ROOT%
echo.

echo [1] Node.js
where node >nul 2>&1
if errorlevel 1 (
  set "OK=0"
  echo   FALTA - Instala Node.js 20 LTS desde https://nodejs.org
  echo          Marca la opcion de agregar al PATH.
  echo          Cerra sesion o reinicia la PC despues de instalar.
) else (
  for /f "tokens=*" %%v in ('node -v') do echo   OK - %%v
)

echo.
echo [2] npm
where npm >nul 2>&1
if errorlevel 1 (
  set "OK=0"
  echo   FALTA - Viene con Node.js. Reinstalalo y reinicia la PC.
) else (
  for /f "tokens=*" %%v in ('npm -v') do echo   OK - npm %%v
)

echo.
echo [3] PowerShell
where powershell >nul 2>&1
if errorlevel 1 (
  set "OK=0"
  echo   FALTA - PowerShell no esta en el PATH (raro en Windows).
) else (
  echo   OK - PowerShell encontrado
)

echo.
echo [4] PostgreSQL (servicio)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'postgres' -or $_.DisplayName -match 'PostgreSQL' }; if (-not $s) { Write-Host '  FALTA o no detectado - Instala PostgreSQL y reinicia'; exit 1 }; $s | ForEach-Object { Write-Host ('  OK - {0} ({1})' -f $_.Name, $_.Status) }"
if errorlevel 1 set "OK=0"

echo.
echo [5] psql (cliente)
where psql >nul 2>&1
if errorlevel 1 (
  echo   AVISO - psql no esta en PATH. El script igual busca en Program Files.
  echo          Si falla crear la base, agrega la carpeta bin de PostgreSQL al PATH.
) else (
  for /f "tokens=*" %%v in ('psql --version') do echo   OK - %%v
)

echo.
echo [6] backend\.env
if exist "%ROOT%\backend\.env" (
  echo   OK - Existe backend\.env
) else (
  echo   AVISO - Todavia no existe. ACTUALIZAR SISTEMA lo puede crear desde .env.example
  echo          Despues edita la contrasena de PostgreSQL de ESTA PC.
)

echo.
echo ============================================
if "%OK%"=="1" (
  echo   REQUISITOS PRINCIPALES: OK
  echo   Podes ejecutar ACTUALIZAR SISTEMA.bat
) else (
  echo   FALTAN REQUISITOS
  echo.
  echo   En la PC nueva hace falta:
  echo   1. Instalar Node.js 20 LTS (nodejs.org) con PATH marcado
  echo   2. Instalar PostgreSQL (con servicio de Windows)
  echo   3. Cerrar sesion o reiniciar la PC
  echo   4. Volver a ejecutar este verificador
  echo   5. Luego ACTUALIZAR SISTEMA.bat
)
echo ============================================
echo.
pause
if "%OK%"=="1" (exit /b 0) else (exit /b 1)
