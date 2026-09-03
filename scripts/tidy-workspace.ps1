# 把 dsp 根目录调试/截图/日志等移入 _scratch/（不删）
# 用法：powershell -File D:/dsp/scripts/tidy-workspace.ps1
#       powershell -File D:/dsp/scripts/tidy-workspace.ps1 -WhatIf
param(
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$Scratch = Join-Path $Root '_scratch'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Dest = Join-Path $Scratch $Stamp

$Patterns = @(
    '_cdp_*',
    '_dsh_*',
    '_doctor-last.json',
    '_fix_corrupted_src.*',
    '_tools',
    '_asar_snip',
    '_asar_tmp',
    '_dsh_extract',
    'dsh-stdout*.txt',
    'dsh-stderr*.txt',
    'dsh-*.png',
    'dsh-electron.log',
    'clipboard-*',
    'ocr-*',
    'parse-asar.js',
    'search-asar.js',
    'search-dsh-src.js',
    'list-asar-presets.js',
    'find-skill-loader.js',
    'main.js',
    'test-zhipu.mjs',
    'get-clipboard-image.ps1',
    'tmp-*.json',
    'package.json.bak-*',
    '*.tgz',
    'nul'
)

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$moved = 0

foreach ($pat in $Patterns) {
    Get-ChildItem -Path $Root -Filter $pat -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Name -match '^(nul|con|prn|aux|com\d|lpt\d)$') { return }
        if ($WhatIf) {
            Write-Host "[whatif] $($_.Name) -> _scratch/$Stamp/"
        } else {
            Move-Item -LiteralPath $_.FullName -Destination $Dest -Force
            Write-Host "moved $($_.Name)"
        }
        $moved++
    }
    Get-ChildItem -Path $Root -Filter $pat -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if ($WhatIf) {
            Write-Host "[whatif] $($_.Name)/ -> _scratch/$Stamp/"
        } else {
            Move-Item -LiteralPath $_.FullName -Destination $Dest -Force
            Write-Host "moved $($_.Name)/"
        }
        $moved++
    }
}

if ($moved -eq 0) {
    Write-Host 'nothing to tidy'
    if (-not $WhatIf) {
        Remove-Item $Dest -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "done: $moved item(s) -> _scratch/$Stamp"
}
