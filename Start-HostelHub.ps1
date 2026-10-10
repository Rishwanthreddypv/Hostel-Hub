param([switch]$Dev)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCandidates = @(Get-Command node -All -ErrorAction SilentlyContinue | ForEach-Object Source)
$nodeCandidates += 'C:\Program Files\nodejs\node.exe'
$nodeCandidates = @($nodeCandidates | Select-Object -Unique)
$selectedNode = $null
foreach ($candidate in $nodeCandidates) {
    if (Test-Path -LiteralPath $candidate) {
        $version = & $candidate --version
        if ([int]($version.TrimStart('v').Split('.')[0]) -ge 24) { $selectedNode = $candidate; break }
    }
}
if (-not $selectedNode) { throw 'Node.js 24 or later is required. Install it from https://nodejs.org and rerun this script.' }
$env:Path = (Split-Path -Parent $selectedNode) + ';' + $env:Path
$npmCli = Join-Path (Split-Path -Parent $selectedNode) 'node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & $selectedNode $npmCli ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if ($Dev) { & $selectedNode $npmCli run dev; exit $LASTEXITCODE }
if (-not (Test-Path -LiteralPath 'dist/index.html')) {
    & $selectedNode $npmCli run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}
Write-Host 'Open http://localhost:4000 in your browser. Press Ctrl+C here to stop.'
& $selectedNode server/index.js
