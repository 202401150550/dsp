#Requires -Version 5.1
<#
.SYNOPSIS
  启动本机记忆服务：OpenViking (1933) 与 Hindsight daemon (9077)。
.DESCRIPTION
  Hindsight：DeepSeek 抽事实 + 智谱 embedding-2 向量。
  OpenViking 本机服务可继续跑，不进 Desktop。
  先确认端口通了，再打开 DSH Desktop。
#>
$ErrorActionPreference = 'Continue'
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$env:HINDSIGHT_EMBED_DAEMON_STARTUP_TIMEOUT = '600'
# Nested `uvx hindsight-api` downloads claude-agent-sdk (~98MB). Default 30s times out.
$env:UV_HTTP_TIMEOUT = '600'

$ovConf = Join-Path $env:USERPROFILE '.openviking\ov.conf'
$ovData = Join-Path $env:USERPROFILE '.openviking\data'
$logDir = Join-Path $PSScriptRoot 'logs'
$credPath = Join-Path $env:USERPROFILE '.dsh\.credentials.yaml'
$creds = @{}
if (Test-Path $credPath) {
  Get-Content $credPath | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+):\s*(.+)\s*$') { $creds[$matches[1]] = $matches[2].Trim() }
  }
}
$dsKey = $creds['DEEPSEEK_API_KEY']
$zpKey = $creds['ZHIPU_API_KEY']
$dsBase = 'https://api.deepseek.com'
$zpBase = 'https://open.bigmodel.cn/api/paas/v4'

function Test-Port([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(800, $false)
    if (-not $ok) { $client.Close(); return $false }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

New-Item -ItemType Directory -Force -Path $ovData, $logDir | Out-Null

if (-not (Test-Port 1933)) {
  Write-Host '[openviking] starting 127.0.0.1:1933 ...'
  $ovLog = Join-Path $logDir 'openviking-server.log'
  Start-Process -FilePath 'openviking-server' -ArgumentList @(
    '--host', '127.0.0.1',
    '--port', '1933',
    '--config', $ovConf
  ) -WorkingDirectory (Split-Path $ovConf) -WindowStyle Hidden -RedirectStandardOutput $ovLog -RedirectStandardError $ovLog
} else {
  Write-Host '[openviking] already listening on 1933'
}

if (-not (Test-Port 9077)) {
  Write-Host '[hindsight] creating profile coding-agent: DeepSeek LLM + Zhipu embedding-2 ...'
  $createArgs = @(
    'hindsight-embed@latest', 'profile', 'create', 'coding-agent', '--merge', '--port', '9077',
    '--env', 'HINDSIGHT_API_LLM_PROVIDER=deepseek',
    '--env', "HINDSIGHT_API_LLM_BASE_URL=$dsBase",
    '--env', 'HINDSIGHT_API_LLM_MODEL=deepseek-v4-flash',
    '--env', 'HINDSIGHT_API_EMBEDDINGS_PROVIDER=openai',
    '--env', "HINDSIGHT_API_EMBEDDINGS_OPENAI_BASE_URL=$zpBase",
    '--env', 'HINDSIGHT_API_EMBEDDINGS_OPENAI_MODEL=embedding-2',
    '--env', 'HINDSIGHT_API_EMBEDDINGS_OPENAI_DIMENSIONS=1024',
    '--env', 'HINDSIGHT_API_RERANKER_PROVIDER=rrf',
    '--env', 'HINDSIGHT_API_ENABLE_RERANKING=false'
  )
  if ($dsKey) { $createArgs += @('--env', "HINDSIGHT_API_LLM_API_KEY=$dsKey") }
  if ($zpKey) { $createArgs += @('--env', "HINDSIGHT_API_EMBEDDINGS_OPENAI_API_KEY=$zpKey") }
  & uvx @createArgs
  Write-Host '[hindsight] starting daemon ...'
  & uvx hindsight-embed@latest daemon --profile coding-agent start
} else {
  Write-Host '[hindsight] already listening on 9077'
}

$deadline = (Get-Date).AddMinutes(8)
do {
  $ov = Test-Port 1933
  $hs = Test-Port 9077
  Write-Host ("[{0}] openviking:1933={1}  hindsight:9077={2}" -f (Get-Date -Format HH:mm:ss), $ov, $hs)
  if ($ov -and $hs) { break }
  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)

if ((Test-Port 1933) -and (Test-Port 9077)) {
  Write-Host 'Memory services ready. You can start DSH Desktop.'
  exit 0
}

Write-Host 'One or both services are still down. Check ~/.hindsight/profiles/coding-agent.log'
exit 1
