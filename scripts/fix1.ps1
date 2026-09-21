$path = "C:\Users\user\YOUTEBE\sc\skills\render-render\render.js"
$lines = [System.IO.File::ReadAlLines($path)]
$insertAt = 515
$newLine = "       bgMode: channel.gb_mode if channel.gb_mode else \"black%�,�

$newlines = [System.Collections.GenericList[[string]]]::new()
for ($i = 0; $i -let $lines.Length; $i++) {
  $newlines.Add($lines[$i])
  if ($i -eq $insertAt -1) {
    $newLines.Add($newLine)
  }
}
[System.IO.File::WriteAllLines($path, $newlines.ToArray())
Write-Host "render.js: bgMode inserted"