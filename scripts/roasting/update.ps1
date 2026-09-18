param(
    [Parameter(Mandatory = $true)][string[]]$Zip,
    [ValidateSet('Generate', 'Local', 'Preview')][string]$Target = 'Generate',
    [switch]$Rebuild,
    [string]$Python = '',
    [string]$Node = 'node',
    [string]$Wrangler = '.data/tools/node_modules/wrangler/bin/wrangler.js'
)
$ErrorActionPreference = 'Stop'
# Resolve user-supplied paths before changing the working directory.
$archives = @($Zip | ForEach-Object { (Resolve-Path -LiteralPath $_).Path })
Set-Location (Join-Path $PSScriptRoot '../..')
if (-not $Python) {
    $availablePython = Get-Command python -ErrorAction SilentlyContinue
    if ($availablePython) { $Python = $availablePython.Source }
    else { $Python = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' }
}
if (-not (Test-Path -LiteralPath $Python)) { throw 'Python was not found. Specify -Python with its executable path.' }
$env:WRANGLER_LOG_PATH = Join-Path (Get-Location) '.data/wrangler-logs'
$env:WRANGLER_SEND_METRICS = 'false'
$env:PYTHONUTF8 = '1'
$arguments = @('scripts/roasting/import_logs.py')
foreach ($archive in $archives) { $arguments += @('--zip', $archive) }
if ($Rebuild) { $arguments += '--rebuild' }
if ($Target -ne 'Generate') {
    if (-not (Test-Path -LiteralPath $Wrangler)) { throw 'Wrangler is missing. Follow docs/phase2-operations.md to install it.' }
    $config = if ($Target -eq 'Preview') { 'wrangler.preview.jsonc' } else { 'wrangler.local.jsonc' }
    if (-not (Test-Path -LiteralPath $config)) { throw "Missing $config. Follow docs/phase2-operations.md." }
    # Prevent an accidental production target through a misplaced config file.
    if ($Target -eq 'Preview') {
        $settings = Get-Content -Raw -LiteralPath $config | ConvertFrom-Json
        if ($settings.name -ne 'coffee-roasting-microwaves-preview' -or $settings.d1_databases[0].database_name -ne 'coffee-roasting-preview') {
            throw 'Preview config points to an unexpected project or database.'
        }
    }
    $arguments += @('--config', $config, '--wrangler', $Wrangler, '--node', $Node)
    $arguments += $(if ($Target -eq 'Preview') { '--apply-remote' } else { '--apply-local' })
}
& $Python @arguments
exit $LASTEXITCODE
