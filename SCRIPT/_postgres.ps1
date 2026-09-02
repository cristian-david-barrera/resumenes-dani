param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('iniciar', 'crear-db', 'estado')]
  [string]$Accion
)

$ErrorActionPreference = 'Continue'

function Get-PostgresServices {
  Get-Service -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match 'postgres' -or $_.DisplayName -match 'PostgreSQL'
    }
}

function Get-PsqlPath {
  $desdePath = Get-Command psql -ErrorAction SilentlyContinue
  if ($desdePath) { return $desdePath.Source }

  $candidatos = @(
    "${env:ProgramFiles}\PostgreSQL\17\bin\psql.exe",
    "${env:ProgramFiles}\PostgreSQL\16\bin\psql.exe",
    "${env:ProgramFiles}\PostgreSQL\15\bin\psql.exe",
    "${env:ProgramFiles}\PostgreSQL\14\bin\psql.exe",
    "${env:ProgramFiles(x86)}\PostgreSQL\17\bin\psql.exe",
    "${env:ProgramFiles(x86)}\PostgreSQL\16\bin\psql.exe"
  )

  foreach ($ruta in $candidatos) {
    if (Test-Path -LiteralPath $ruta) { return $ruta }
  }
  return $null
}

function Get-DatabaseUrl {
  $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'backend\.env'
  if (-not (Test-Path -LiteralPath $envPath)) { return $null }

  $linea = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
    Select-Object -First 1

  if (-not $linea) { return $null }
  return ($linea -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
}

function Get-PgPasswordFromUrl([string]$url) {
  # postgresql://user:pass@host:port/db
  if ($url -match '://([^:/]+):([^@]+)@') {
    return $Matches[2]
  }
  return $null
}

function Get-PgUserFromUrl([string]$url) {
  if ($url -match '://([^:/]+):') {
    return $Matches[1]
  }
  return 'postgres'
}

switch ($Accion) {
  'iniciar' {
    $servicios = @(Get-PostgresServices)
    if ($servicios.Count -eq 0) {
      Write-Host '  [AVISO] No se encontro un servicio PostgreSQL en Windows.'
      Write-Host '  Si PostgreSQL esta instalado, inicia el servicio manualmente.'
      exit 0
    }

    foreach ($svc in $servicios) {
      if ($svc.Status -eq 'Running') {
        Write-Host ("  Servicio ya activo: {0}" -f $svc.Name)
        continue
      }

      try {
        Write-Host ("  Iniciando servicio: {0} ..." -f $svc.Name)
        Start-Service -Name $svc.Name -ErrorAction Stop
        Write-Host ("  OK: {0}" -f $svc.Name)
      } catch {
        Write-Host ("  [AVISO] No se pudo iniciar {0}: {1}" -f $svc.Name, $_.Exception.Message)
        Write-Host '  Proba ejecutando este script como Administrador.'
      }
    }
  }

  'crear-db' {
    $psql = Get-PsqlPath
    if (-not $psql) {
      Write-Host '  [AVISO] No se encontro psql.exe. Crea la base "daniela" a mano si hace falta.'
      exit 0
    }

    $url = Get-DatabaseUrl
    $user = if ($url) { Get-PgUserFromUrl $url } else { 'postgres' }
    $pass = if ($url) { Get-PgPasswordFromUrl $url } else { $null }

    if ($pass) {
      $env:PGPASSWORD = $pass
    }

    Write-Host ("  Usando psql: {0}" -f $psql)
    Write-Host ("  Usuario: {0}" -f $user)

    $existe = & $psql -U $user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='daniela'" 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host '  [AVISO] No se pudo consultar PostgreSQL.'
      Write-Host '  Revisa la contraseña en backend\.env (DATABASE_URL).'
      exit 0
    }

    if ($existe -match '1') {
      Write-Host '  La base "daniela" ya existe.'
    } else {
      & $psql -U $user -d postgres -c "CREATE DATABASE daniela;" | Out-Host
      if ($LASTEXITCODE -eq 0) {
        Write-Host '  Base "daniela" creada.'
      } else {
        Write-Host '  [AVISO] No se pudo crear la base "daniela".'
      }
    }
  }

  'estado' {
    $servicios = @(Get-PostgresServices)
    if ($servicios.Count -eq 0) {
      Write-Host 'Sin servicios PostgreSQL detectados.'
      exit 0
    }
    $servicios | ForEach-Object {
      Write-Host ("{0} => {1}" -f $_.Name, $_.Status)
    }
  }
}
