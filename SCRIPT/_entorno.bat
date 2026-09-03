@echo off
REM Recarga rutas tipicas de Node.js y PostgreSQL en esta sesion.
REM IMPORTANTE: no usar bloques con parentesis aqui. %ProgramFiles(x86)%
REM rompe el parser de cmd si esta dentro de IF (...).

set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"

if exist "%PF%\nodejs\node.exe" set "PATH=%PF%\nodejs;%PATH%"
if exist "%PF86%\nodejs\node.exe" set "PATH=%PF86%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
if exist "%APPDATA%\npm" set "PATH=%APPDATA%\npm;%PATH%"

for %%V in (24 23 22 21 20 19 18 17 16 15 14) do if exist "%PF%\PostgreSQL\%%V\bin\psql.exe" set "PATH=%PF%\PostgreSQL\%%V\bin;%PATH%"
for %%V in (24 23 22 21 20 19 18 17 16 15 14) do if exist "%PF86%\PostgreSQL\%%V\bin\psql.exe" set "PATH=%PF86%\PostgreSQL\%%V\bin;%PATH%"
