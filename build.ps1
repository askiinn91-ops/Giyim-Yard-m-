param(
    [string]$Configuration = 'Release',
    [string]$PackagesPath = (Join-Path $PSScriptRoot '.build/packages')
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$projectDir = Join-Path $repoRoot 'Exe'
$isolatedAppData = Join-Path $repoRoot '.build/appdata'
$publishDir = Join-Path $repoRoot 'publish'

New-Item -ItemType Directory -Force -Path $isolatedAppData, $PackagesPath, $publishDir | Out-Null

# NuGet ve MSBuild'in kullanıcı profilindeki ayarlara bağımlı kalmaması için izole profil.
$env:APPDATA = $isolatedAppData
$env:NUGET_PACKAGES = $PackagesPath

$arguments = @(
    'publish', (Join-Path $projectDir 'GiyimYardimiExe.csproj'),
    '-c', $Configuration,
    '-o', $publishDir,
    "-p:RestorePackagesPath=$PackagesPath",
    "-p:RestoreConfigFile=$(Join-Path $projectDir 'NuGet.Config')",
    '-p:NuGetAudit=false'
)

& dotnet @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Yayın klasörü: $publishDir" -ForegroundColor Green
