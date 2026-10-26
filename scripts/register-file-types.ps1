param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $project 'node_modules\electron\dist\electron.exe'
$icon = Join-Path $project 'build\icon.ico'
$classes = 'HKCU:\Software\Classes'
$otherTypes = '.docx', '.docm', '.dotx', '.dotm', '.doc', '.dot', '.odt', '.rtf', '.txt', '.md', '.markdown', '.pdf', '.html', '.htm'

function Set-Key($path, $name, $value) {
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  if ($name -eq '') { Set-Item -Path $path -Value $value } else { New-ItemProperty -Path $path -Name $name -Value $value -PropertyType String -Force | Out-Null }
}

if ($Remove) {
  foreach ($ext in $otherTypes) {
    $key = "$classes\$ext\OpenWithProgids"
    if (Test-Path $key) { Remove-ItemProperty -Path $key -Name 'MooPress.Document' -ErrorAction SilentlyContinue }
  }
  $key = "$classes\.moopress"
  if ((Test-Path $key) -and ((Get-Item $key).GetValue('') -eq 'MooPress.Book')) { Remove-Item $key -Recurse -Force }
  foreach ($key in "$classes\MooPress.Book", "$classes\MooPress.Document") { if (Test-Path $key) { Remove-Item $key -Recurse -Force } }
  Write-Host 'MooPress file types removed.'
  exit 0
}

if (-not (Test-Path $electron)) { throw "Electron isn't installed yet. Run 'npm install' in $project first." }
if (-not (Test-Path (Join-Path $project 'dist\index.html'))) {
  Write-Host 'Building MooPress first (npm run build)...'
  Push-Location $project; npm run build | Out-Null; Pop-Location
}

$command = "`"$electron`" `"$project`" `"%1`""

Set-Key "$classes\.moopress" '' 'MooPress.Book'
Set-Key "$classes\MooPress.Book" '' 'MooPress Book'
Set-Key "$classes\MooPress.Book\DefaultIcon" '' "`"$icon`",0"
Set-Key "$classes\MooPress.Book\shell\open" 'FriendlyAppName' 'MooPress'
Set-Key "$classes\MooPress.Book\shell\open\command" '' $command

Set-Key "$classes\MooPress.Document" '' 'Document'
Set-Key "$classes\MooPress.Document\DefaultIcon" '' "`"$icon`",0"
Set-Key "$classes\MooPress.Document\shell\open" 'FriendlyAppName' 'MooPress'
Set-Key "$classes\MooPress.Document\shell\open\command" '' $command
foreach ($ext in $otherTypes) { Set-Key "$classes\$ext\OpenWithProgids" 'MooPress.Document' '' }

Add-Type -Namespace Win32 -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, uint f, System.IntPtr a, System.IntPtr b);'
[Win32.Shell]::SHChangeNotify(0x08000000, 0, [System.IntPtr]::Zero, [System.IntPtr]::Zero)

Write-Host 'Done. .moopress files now open in MooPress, and MooPress appears under "Open with" for Word, PDF, RTF, ODT, text and Markdown files.'
