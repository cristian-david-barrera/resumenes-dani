@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Proyecto Daniela - ACTUALIZAR SISTEMA

cd /d "%~dp0.."
set "ROOT=%CD%"
call "%~dp0_entorno.bat"

echo.
echo ============================================
echo   PROYECTO DANIELA - ACTUALIZAR SISTEMA
echo ============================================
echo.
echo Carpeta del proyecto:
echo   %ROOT%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en esta PC.
  echo.
  echo Configuracion previa necesaria:
  echo   1. Instalar Node.js 20 LTS desde https://nodejs.org
  echo      ^(marcar "Add to PATH"^)
  echo   2. Instalar PostgreSQL
  echo   3. Cerrar sesion o reiniciar la PC
  echo   4. Ejecutar "VERIFICAR REQUISITOS.bat"
  echo   5. Volver a ejecutar este script
  goto :fin_error
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro npm.
  echo Reinstalá Node.js 20 LTS, reiniciá la PC y proba de nuevo.
  echo Tambien podes ejecutar "VERIFICAR REQUISITOS.bat"
  goto :fin_error
)

for /f "tokens=*" %%v in ('node -v') do echo Node: %%v
for /f "tokens=*" %%v in ('npm -v') do echo npm:  %%v
echo.

echo [1/5] Configurando backend\.env ...
if not exist "%ROOT%\backend\.env" (
  if exist "%ROOT%\backend\.env.example" (
    copy /Y "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
    echo   Se creo backend\.env desde .env.example
    echo   IMPORTANTE: edita backend\.env y pone la contraseña real de PostgreSQL
    echo   de ESTA PC ^(no copies la de la otra maquina si es distinta^).
  ) else (
    echo [ERROR] Falta backend\.env y no hay .env.example
    goto :fin_error
  )
) else (
  echo   backend\.env ya existe - no se modifica.
)
echo.

echo [2/5] Iniciando servicio PostgreSQL (si existe)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_postgres.ps1" -Accion iniciar
if errorlevel 1 (
  echo   [AVISO] No se pudo iniciar PostgreSQL automaticamente.
  echo           Continua igual; revisalo si luego falla la base.
)
echo.

echo [3/5] Creando base de datos "daniela" si no existe...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_postgres.ps1" -Accion crear-db
if errorlevel 1 (
  echo   [AVISO] No se pudo crear/verificar la base automaticamente.
  echo           Revisa la contraseña en backend\.env
)
echo.

echo [4/5] Instalando dependencias del backend...
pushd "%ROOT%\backend"
call npm.cmd install
if errorlevel 1 (
  popd
  echo [ERROR] Fallo npm install en backend
  echo Si el mensaje dice que no reconoce npm/node, falta Node en PATH.
  echo Ejecuta "VERIFICAR REQUISITOS.bat"
  goto :fin_error
)
echo Compilando backend...
call npm.cmd run build
if errorlevel 1 (
  popd
  echo [ERROR] Fallo la compilacion del backend
  goto :fin_error
)
popd
echo   Backend listo.
echo.

echo [5/5] Instalando dependencias del frontend...
pushd "%ROOT%\frontend"
call npm.cmd install
if errorlevel 1 (
  popd
  echo [ERROR] Fallo npm install en frontend
  goto :fin_error
)
echo Compilando frontend...
call npm.cmd run build
if errorlevel 1 (
  popd
  echo [ERROR] Fallo la compilacion del frontend
  goto :fin_error
)
popd
echo   Frontend listo.
echo.

echo ============================================
echo   ACTUALIZACION COMPLETA
echo ============================================
echo.
echo Proximos pasos:
echo   1. Revisar backend\.env (usuario/contraseña de PostgreSQL de esta PC)
echo   2. Doble clic en "INICIAR SISTEMA.bat"
echo.
pause
exit /b 0

:fin_error
echo.
echo La actualizacion no se completo. Revisá los mensajes de arriba.
echo Tip: ejecuta primero "VERIFICAR REQUISITOS.bat"
echo.
pause
exit /b 1
