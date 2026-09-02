@echo off
REM Recarga rutas tipicas de Node.js y PostgreSQL en esta sesion.
REM Se usa al inicio de ACTUALIZAR / INICIAR para PCs recien instaladas.

set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%PATH%"

for %%V in (18 19 20 21 22 17 16 15 14) do (
  if exist "%ProgramFiles%\PostgreSQL\%%V\bin\psql.exe" (
    set "PATH=%ProgramFiles%\PostgreSQL\%%V\bin;%PATH%"
  )
  if exist "%ProgramFiles(x86)%\PostgreSQL\%%V\bin\psql.exe" (
    set "PATH=%ProgramFiles(x86)%\PostgreSQL\%%V\bin;%PATH%"
  )
)
