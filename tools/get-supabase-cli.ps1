param(
  [string]$Version = 'latest'
)

$ErrorActionPreference = 'Stop'

function Get-ReleaseJson([string]$version) {
  $headers = @{ 'User-Agent' = 'moovepay-tools' }

  if ($version -eq 'latest' -or [string]::IsNullOrWhiteSpace($version)) {
    return Invoke-RestMethod -Headers $headers -Uri 'https://api.github.com/repos/supabase/cli/releases/latest'
  }

  $tag = $version
  if ($tag -notmatch '^v') { $tag = "v$tag" }
  return Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/supabase/cli/releases/tags/$tag"
}

function Get-AssetUrl($releaseJson) {
  $assets = @($releaseJson.assets)
  if (-not $assets -or $assets.Count -eq 0) {
    throw 'Nenhum asset encontrado no release do Supabase CLI.'
  }

  $preferredNames = @(
    'supabase_windows_amd64.tar.gz',
    'supabase_windows_amd64.zip'
  )

  foreach ($name in $preferredNames) {
    $asset = $assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if ($asset) { return $asset.browser_download_url }
  }

  $names = ($assets | Select-Object -ExpandProperty name) -join ', '
  throw "Não encontrei asset Windows amd64. Assets disponíveis: $names"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $repoRoot 'tools\supabase-cli'
$destExe = Join-Path $destDir 'supabase.exe'

New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$release = Get-ReleaseJson -version $Version
$url = Get-AssetUrl -releaseJson $release

$tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("moovepay-supabase-cli-" + [guid]::NewGuid().ToString('n'))
$tmpArchive = Join-Path $tmpRoot 'supabase-cli-archive'
$tmpExtract = Join-Path $tmpRoot 'extract'

New-Item -ItemType Directory -Force -Path $tmpRoot, $tmpExtract | Out-Null

try {
  Write-Host "Baixando: $url" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $tmpArchive

  if ($url -match '\.zip$') {
    Expand-Archive -Path $tmpArchive -DestinationPath $tmpExtract -Force
  } else {
    # tar.gz (disponível no Windows 10/11)
    tar -xzf $tmpArchive -C $tmpExtract
  }

  $exe = Get-ChildItem -Path $tmpExtract -Recurse -Filter 'supabase.exe' | Select-Object -First 1
  if (-not $exe) { throw 'Não encontrei supabase.exe após extrair o pacote.' }

  Copy-Item -Force -Path $exe.FullName -Destination $destExe

  $verText = $release.tag_name
  Set-Content -Path (Join-Path $destDir 'VERSION.txt') -Value $verText -Encoding UTF8

  Write-Host "OK: $destExe ($verText)" -ForegroundColor Green
  Write-Host "Dica: rode .\\tools\\supabase-cli\\supabase.exe --version" -ForegroundColor DarkGray
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmpRoot
}
