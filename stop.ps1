$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root 'server.pid'
try { Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:38117/api/stop' -TimeoutSec 2 | Out-Null } catch { }
Start-Sleep -Milliseconds 500
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host 'Giyim Yardımı Programı kapatıldı.'
