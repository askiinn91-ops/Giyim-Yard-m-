$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 38117
$prefix = "http://127.0.0.1:$port/"
$dataFile = Join-Path $root 'veriler.json'
$pidFile = Join-Path $root 'server.pid'
[System.IO.File]::WriteAllText($pidFile, "$PID", [System.Text.Encoding]::ASCII)
if (-not (Test-Path $dataFile)) {
  $initial = '{"institutions":[],"staff":[],"tariffs":[],"years":[],"batches":[]}'
  [System.IO.File]::WriteAllText($dataFile, $initial, [System.Text.UTF8Encoding]::new($false))
}
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $port)
function Send-Response($stream, [int]$status, [string]$reason, [string]$contentType, [byte[]]$body) {
  $header = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $h = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($h,0,$h.Length)
  if ($body.Length -gt 0) { $stream.Write($body,0,$body.Length) }
  $stream.Flush()
}
try {
  $listener.Start()
  $stopping = $false
  while (-not $stopping) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    try {
      $headStream = [System.IO.MemoryStream]::new()
      $matched = 0
      while ($matched -lt 4) {
        $v = $stream.ReadByte()
        if ($v -lt 0) { break }
        $headStream.WriteByte([byte]$v)
        if (($matched -eq 0 -or $matched -eq 2) -and $v -eq 13) { $matched++ }
        elseif (($matched -eq 1 -or $matched -eq 3) -and $v -eq 10) { $matched++ }
        else { $matched = if ($v -eq 13) { 1 } else { 0 } }
      }
      $head = [System.Text.Encoding]::ASCII.GetString($headStream.ToArray())
      $lines = $head -split "`r`n"
      if ($lines.Count -lt 1) { continue }
      $parts = $lines[0].Split(' ')
      $method = $parts[0]
      $path = if ($parts.Count -gt 1) { $parts[1].Split('?')[0] } else { '/' }
      $contentLength = 0
      foreach ($line in $lines) { if ($line -match '^Content-Length:\s*(\d+)') { $contentLength = [int]$Matches[1] } }
      $bodyBytes = [byte[]]::new($contentLength)
      $offset = 0
      while ($offset -lt $contentLength) { $n = $stream.Read($bodyBytes,$offset,$contentLength-$offset); if ($n -le 0) { break }; $offset += $n }
      if ($method -eq 'GET' -and $path -eq '/api/official-tariffs/2026') {
      try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $pdfUrl = 'https://ms.hmb.gov.tr/uploads/2026/01/EK-1-2-9611941dfe107036.pdf'
        $client = [System.Net.WebClient]::new()
        $client.Headers.Add('User-Agent','GiyimYardimiProgrami/1.0')
        $pdfBytes = $client.DownloadData($pdfUrl)
        if ($pdfBytes.Length -lt 5000 -or [System.Text.Encoding]::ASCII.GetString($pdfBytes,0,5) -ne '%PDF-') { throw 'Bakanliktan gecerli PDF alinmadi.' }
        Send-Response $stream 200 'OK' 'application/pdf' $pdfBytes
      } catch {
        $message = [System.Text.Encoding]::UTF8.GetBytes('{"error":"official_pdf_unavailable"}')
        Send-Response $stream 502 'Bad Gateway' 'application/json; charset=utf-8' $message
      } finally {
        if ($client) { $client.Dispose() }
      }
      } elseif ($method -eq 'GET' -and $path -eq '/api/data') {
      $bytes = [System.IO.File]::ReadAllBytes($dataFile)
      Send-Response $stream 200 'OK' 'application/json; charset=utf-8' $bytes
      } elseif ($method -eq 'POST' -and $path -eq '/api/data') {
      $body = [System.Text.Encoding]::UTF8.GetString($bodyBytes)
      $null = $body | ConvertFrom-Json
      [System.IO.File]::WriteAllText($dataFile,$body,[System.Text.UTF8Encoding]::new($false))
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"saved":true}')
      Send-Response $stream 200 'OK' 'application/json; charset=utf-8' $bytes
      } elseif ($method -eq 'POST' -and $path -eq '/api/stop') {
      Send-Response $stream 200 'OK' 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('stopped'))
      $stopping = $true
      } elseif ($method -eq 'GET' -and ($path -eq '/' -or $path -eq '/index.html' -or $path -eq '/app.js' -or $path -eq '/styles.css' -or $path -eq '/print.css')) {
      $fileName = if ($path -eq '/') { 'index.html' } else { $path.TrimStart('/') }
      $filePath = Join-Path $root $fileName
      if (-not (Test-Path $filePath)) { Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('Not found')); continue }
      $ext = [System.IO.Path]::GetExtension($filePath)
      $type = switch ($ext) { '.html' {'text/html; charset=utf-8'} '.js' {'text/javascript; charset=utf-8'} '.css' {'text/css; charset=utf-8'} default {'application/octet-stream'} }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      Send-Response $stream 200 'OK' $type $bytes
      } else {
      Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('Not found'))
      }
    } catch {
      $err = [System.Text.Encoding]::UTF8.GetBytes('{"error":"request_failed"}')
      try { Send-Response $stream 500 'Internal Server Error' 'application/json; charset=utf-8' $err } catch { }
    } finally { $stream.Dispose(); $client.Dispose() }
  }
} finally {
  try { $listener.Stop() } catch { }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}
