param([string]$Node = 'node', [string]$Wrangler = '.data/tools/node_modules/wrangler/bin/wrangler.js')
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
$env:WRANGLER_LOG_PATH = Join-Path (Get-Location) '.data/wrangler-logs'
$env:WRANGLER_SEND_METRICS = 'false'
if (-not (Test-Path -LiteralPath 'wrangler.jsonc')) {
    Copy-Item -LiteralPath 'wrangler.local.jsonc' -Destination 'wrangler.jsonc'
}
& $Node $Wrangler pages dev dist --port 8788 --ip 127.0.0.1
exit $LASTEXITCODE
