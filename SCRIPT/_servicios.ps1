param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('iniciar', 'detener', 'esperar')]
  [string]$Accion,

  [string]$Root = ''
)

$ErrorActionPreference = 'Continue'

if (-not $Root) {
  $Root = Split-Path $PSScriptRoot -Parent
}

$logDir = Join-Path $PSScriptRoot 'logs'
$pidFile = Join-Path $PSScriptRoot '.pids'

function Get-NpmCmd {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npm) { return $npm.Source }
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) { return $npm.Source }
  throw 'No se encontro npm. Instala Node.js 20+.'
}

function Test-PuertoAbierto([int]$Puerto) {
  try {
    $tcp = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue
    if ($tcp) { return $true }
  } catch {}

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect('127.0.0.1', $Puerto, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(400)
    if ($ok -and $client.Connected) {
      $client.EndConnect($async)
      $client.Close()
      return $true
    }
    $client.Close()
  } catch {}

  return $false
}

function Stop-Puerto([int]$Puerto) {
  $conexiones = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conexiones) {
    $pidProc = $c.OwningProcess
    if ($pidProc -and $pidProc -gt 0) {
      Write-Host ("  Cerrando puerto {0} (PID {1})..." -f $Puerto, $pidProc)
      Stop-Process -Id $pidProc -Force -ErrorAction SilentlyContinue
    }
  }
}

function Stop-PidsGuardados {
  if (-not (Test-Path -LiteralPath $pidFile)) { return }
  $pids = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue |
    Where-Object { $_ -match '^\d+$' }
  foreach ($id in $pids) {
    Stop-Process -Id ([int]$id) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

switch ($Accion) {
  'detener' {
    Stop-PidsGuardados
    Stop-Puerto 3001
    Stop-Puerto 5173
    Write-Host '  Servicios detenidos.'
  }

  'esperar' {
    $maxSegundos = 30
    $listoFrontend = $false
    $listoBackend = $false

    for ($i = 1; $i -le $maxSegundos; $i++) {
      if (-not $listoBackend) { $listoBackend = Test-PuertoAbierto 3001 }
      if (-not $listoFrontend) { $listoFrontend = Test-PuertoAbierto 5173 }

      if ($listoBackend -and $listoFrontend) {
        Write-Host ("  Listo en {0}s (backend + frontend)." -f $i)
        exit 0
      }

      Start-Sleep -Seconds 1
    }

    if ($listoFrontend) {
      Write-Host '  Frontend listo. Backend aun no respondio (podes usar la pantalla igual).'
      exit 0
    }

    Write-Host '  [AVISO] No se detecto el frontend a tiempo.'
    Write-Host '  Revisa SCRIPT\logs\frontend.err.log y backend.err.log'
    exit 0
  }

  'iniciar' {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    # Evita dejar instancias previas colgadas
    Stop-PidsGuardados
    Stop-Puerto 3001
    Stop-Puerto 5173

    $npm = Get-NpmCmd
    $backendDir = Join-Path $Root 'backend'
    $frontendDir = Join-Path $Root 'frontend'
    $backendOut = Join-Path $logDir 'backend.out.log'
    $backendErr = Join-Path $logDir 'backend.err.log'
    $frontendOut = Join-Path $logDir 'frontend.out.log'
    $frontendErr = Join-Path $logDir 'frontend.err.log'

    Write-Host '  Iniciando backend oculto (puerto 3001)...'
    $backend = Start-Process `
      -FilePath $npm `
      -ArgumentList @('start') `
      -WorkingDirectory $backendDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $backendOut `
      -RedirectStandardError $backendErr `
      -PassThru

    Write-Host '  Iniciando frontend oculto (puerto 5173)...'
    $frontend = Start-Process `
      -FilePath $npm `
      -ArgumentList @('run', 'preview', '--', '--host', '--port', '5173') `
      -WorkingDirectory $frontendDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $frontendOut `
      -RedirectStandardError $frontendErr `
      -PassThru

    @(
      $backend.Id
      $frontend.Id
    ) | Set-Content -LiteralPath $pidFile -Encoding ascii

    Write-Host ("  Backend PID:  {0}" -f $backend.Id)
    Write-Host ("  Frontend PID: {0}" -f $frontend.Id)
    Write-Host ("  Logs en: {0}" -f $logDir)
  }
}
