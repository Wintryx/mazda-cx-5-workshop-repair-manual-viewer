# ocr_batch.ps1 - OCR ueber die gerenderten Seiten (Windows.Media.Ocr).
#
# Aufruf:
#   powershell -NoProfile -File tools\ocr_batch.ps1 `
#       -Manifest "$env:TEMP\mazda-ocr\manifest.json" `
#       -Out      "$env:TEMP\mazda-ocr\results.json"
#
# Voraussetzung: Windows-OCR-Sprachpaket (hier de-DE). Das Skript schreibt
# ausschliesslich die Ergebnisdatei; die Bilder werden nur gelesen.
param(
  [Parameter(Mandatory = $true)][string]$Manifest,
  [Parameter(Mandatory = $true)][string]$Out
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

function Await($op, $type) {
  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $engine) { Write-Error 'Keine OCR-Sprache installiert'; exit 2 }

$items = Get-Content $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$results = New-Object System.Collections.Generic.List[object]
$done = 0

foreach ($it in $items) {
  $done++
  $lines = @()
  try {
    $bytes = [System.IO.File]::ReadAllBytes($it.png)
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $writer = [Windows.Storage.Streams.DataWriter]::new($stream)
    $writer.WriteBytes($bytes)
    $null = Await ($writer.StoreAsync()) ([uint32])
    $null = Await ($writer.FlushAsync()) ([bool])
    $stream.Seek(0)
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $r = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = @($r.Lines | ForEach-Object { $_.Text })
    $bitmap.Dispose()
    $stream.Dispose()
  } catch {
    Write-Warning ("OCR fehlgeschlagen: {0} - {1}" -f $it.file, $_.Exception.Message)
  }
  $results.Add([pscustomobject]@{ file = $it.file; lines = $lines })
  if ($done % 25 -eq 0) { Write-Host "$done / $($items.Count)" }
}

$results | ConvertTo-Json -Depth 5 -Compress | Set-Content $Out -Encoding UTF8
Write-Host "Fertig: $($results.Count) Seiten -> $Out"
