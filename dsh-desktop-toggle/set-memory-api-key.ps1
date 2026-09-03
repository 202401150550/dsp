#Requires -Version 5.1
<#
.SYNOPSIS
  写入可用的 OPENAI_API_KEY，并同步到 OpenViking / Hindsight，然后重启记忆服务。
.DESCRIPTION
  用法（不会在屏幕打印完整 key）：
    .\set-memory-api-key.ps1 -ApiKey 'sk-...'
    .\set-memory-api-key.ps1 -ApiKey 'sk-...' -BaseUrl 'https://api.yunnet.top/v1'

  仅用于替换 OPENAI_API_KEY / yunnet 网关。Hindsight 记忆已改成
  DeepSeek 抽事实 + 智谱 embedding-2，不要再用本脚本把 Hindsight 改回 yunnet。
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,
  [string]$BaseUrl = ''
)

$ErrorActionPreference = 'Stop'
$ApiKey = $ApiKey.Trim()
if ($ApiKey.Length -lt 20) { throw 'ApiKey looks too short' }

if (-not $BaseUrl) {
  $BaseUrl = [Environment]::GetEnvironmentVariable('OPENAI_BASE_URL', 'User')
  if (-not $BaseUrl) { $BaseUrl = [Environment]::GetEnvironmentVariable('OPENAI_BASE_URL', 'Process') }
  if (-not $BaseUrl) { $BaseUrl = 'https://api.yunnet.top/v1' }
}
$BaseUrl = $BaseUrl.Trim().TrimEnd('/')

Write-Host "Updating User OPENAI_API_KEY (len=$($ApiKey.Length)) base=$BaseUrl"

[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $ApiKey, 'User')
[Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', $BaseUrl, 'User')
$env:OPENAI_API_KEY = $ApiKey
$env:OPENAI_BASE_URL = $BaseUrl

# Probe without printing the key
try {
  $r = Invoke-WebRequest -Uri ($BaseUrl + '/models') -Headers @{ Authorization = "Bearer $ApiKey" } -TimeoutSec 15 -UseBasicParsing
  Write-Host "gateway /models => $($r.StatusCode) OK"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Write-Host "gateway /models => FAIL status=$code"
  Write-Host 'Key still rejected. Get a fresh key from the gateway dashboard, then re-run this script.'
  exit 2
}

# Sync OpenViking ov.conf
$ovConf = Join-Path $env:USERPROFILE '.openviking\ov.conf'
if (Test-Path $ovConf) {
  $j = Get-Content $ovConf -Raw | ConvertFrom-Json
  if ($j.embedding -and $j.embedding.dense) {
    $j.embedding.dense.api_key = $ApiKey
    $j.embedding.dense.api_base = $BaseUrl
  }
  if ($j.vlm) {
    $j.vlm.api_key = $ApiKey
    $j.vlm.api_base = $BaseUrl
  }
  $j | ConvertTo-Json -Depth 10 | Set-Content $ovConf -Encoding utf8
  Write-Host 'updated ~/.openviking/ov.conf'
}

# Sync Hindsight profile env
$hsEnv = Join-Path $env:USERPROFILE '.hindsight\profiles\coding-agent.env'
if (Test-Path $hsEnv) {
  $text = Get-Content $hsEnv -Raw
  $pairs = @{
    'HINDSIGHT_API_LLM_PROVIDER' = 'openai'
    'HINDSIGHT_API_LLM_BASE_URL' = $BaseUrl
    'HINDSIGHT_API_LLM_API_KEY' = $ApiKey
    'HINDSIGHT_API_EMBEDDINGS_PROVIDER' = 'openai'
    'HINDSIGHT_API_EMBEDDINGS_OPENAI_BASE_URL' = $BaseUrl
    'HINDSIGHT_API_EMBEDDINGS_OPENAI_API_KEY' = $ApiKey
    'HINDSIGHT_API_EMBEDDINGS_OPENAI_MODEL' = 'text-embedding-3-small'
    'HINDSIGHT_API_RERANKER_PROVIDER' = 'rrf'
    'HINDSIGHT_API_ENABLE_RERANKING' = 'false'
  }
  foreach ($k in $pairs.Keys) {
    $v = $pairs[$k]
    if ($text -match "(?m)^$k=") {
      $text = [regex]::Replace($text, "(?m)^$k=.*$", "$k=$v")
    } else {
      $text = $text.TrimEnd() + "`n$k=$v`n"
    }
  }
  Set-Content $hsEnv -Value $text -Encoding utf8 -NoNewline
  Write-Host 'updated ~/.hindsight/profiles/coding-agent.env'
}

# Restart OpenViking if present
Get-Process openviking-server -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$ovData = Join-Path $env:USERPROFILE '.openviking'
if (Get-Command openviking-server -ErrorAction SilentlyContinue) {
  Start-Process -FilePath 'openviking-server' -ArgumentList @(
    '--host', '127.0.0.1', '--port', '1933', '--config', $ovConf
  ) -WorkingDirectory $ovData -WindowStyle Hidden
  Write-Host 'restarted openviking-server'
}

# Restart Hindsight daemon
$env:PYTHONUTF8 = '1'
$env:HINDSIGHT_EMBED_DAEMON_STARTUP_TIMEOUT = '180'
& uvx hindsight-embed@latest daemon --profile coding-agent stop 2>$null
Start-Sleep -Seconds 2
& uvx hindsight-embed@latest daemon --profile coding-agent start
Write-Host 'restarted hindsight daemon'
Write-Host 'Done. Fully quit and reopen DSH Desktop if it was open.'
