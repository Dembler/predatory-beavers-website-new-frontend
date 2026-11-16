param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendRoot = (Resolve-Path (Join-Path $frontendRoot '..\predatory-beavers-website-new-backend')).Path
$runtimeRoot = Join-Path $frontendRoot '.data\bobrik-local'
$processFile = Join-Path $runtimeRoot 'processes.json'

if ($Stop) {
    if (Test-Path -LiteralPath $processFile) {
        $ownedProcesses = Get-Content -Raw -LiteralPath $processFile | ConvertFrom-Json
        foreach ($ownedProcess in $ownedProcesses) {
            $runningProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($ownedProcess.id)" -ErrorAction SilentlyContinue
            if ($runningProcess -and $runningProcess.CreationDate.ToUniversalTime().Ticks.ToString() -eq $ownedProcess.created) {
                Stop-Process -Id $ownedProcess.id -ErrorAction SilentlyContinue
            }
        }
        Remove-Item -LiteralPath $processFile
    }
    Write-Output 'Stopped the isolated Bobrik runtime.'
    exit
}

foreach ($localPort in @(8001, 5176)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $localPort -ErrorAction SilentlyContinue) {
        throw "Port $localPort is in use. Stop the existing Bobrik runtime before starting another."
    }
}

$pythonExecutable = Join-Path $backendRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath (Join-Path $backendRoot '.env.bobrik'))) {
    Copy-Item -LiteralPath (Join-Path $backendRoot '.env.bobrik.example') -Destination (Join-Path $backendRoot '.env.bobrik')
}
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
Push-Location $backendRoot
try {
    & $pythonExecutable scripts/bobrik_local.py init
    if ($LASTEXITCODE -ne 0) { throw 'Bobrik database initialization failed.' }
} finally { Pop-Location }

$startedProcesses = @()
try {
    foreach ($runtimeRole in @('api', 'worker', 'editorial-worker')) {
        $runtimeProcess = Start-Process -FilePath $pythonExecutable -ArgumentList @('scripts/bobrik_local.py', $runtimeRole) -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeRoot "$runtimeRole.out.log") -RedirectStandardError (Join-Path $runtimeRoot "$runtimeRole.err.log")
        $startedProcesses += $runtimeProcess
    }
    $oldProxy = $env:API_PROXY_TARGET
    $oldMascot = $env:VITE_MASCOT_ENABLED
    try {
        $env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
        $env:VITE_MASCOT_ENABLED = 'true'
        $runtimeProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5176', '--strictPort') -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeRoot 'frontend.out.log') -RedirectStandardError (Join-Path $runtimeRoot 'frontend.err.log')
        $startedProcesses += $runtimeProcess
    } finally {
        $env:API_PROXY_TARGET = $oldProxy
        $env:VITE_MASCOT_ENABLED = $oldMascot
    }
    $processRecords = @($startedProcesses | ForEach-Object {
        $runtimeInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)"
        @{ id = $_.Id; created = $runtimeInfo.CreationDate.ToUniversalTime().Ticks.ToString() }
    })
    ConvertTo-Json -InputObject $processRecords | Set-Content -Encoding UTF8 -LiteralPath $processFile
} catch {
    $startedProcesses | Stop-Process -ErrorAction SilentlyContinue
    throw
}

Write-Output 'Bobrik: http://127.0.0.1:5176 | API: http://127.0.0.1:8001/docs'
Write-Output 'Stop: powershell -File scripts/bobrik-local.ps1 -Stop'
