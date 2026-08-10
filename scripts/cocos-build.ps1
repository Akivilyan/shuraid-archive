param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("web-mobile", "wechatgame")]
  [string]$Target
)

$ErrorActionPreference = "Stop"

$creator = "C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$projectPath = Join-Path $repositoryRoot "cocos-client"
$configPath = Join-Path $PSScriptRoot ("cocos-build-config\" + $Target + ".json")
$logDirectory = Join-Path $projectPath "build-logs"
$logPath = Join-Path $logDirectory ($Target + ".log")
$outputPath = Join-Path $projectPath ("build\" + $Target)
$entryPath = if ($Target -eq "web-mobile") {
  Join-Path $outputPath "index.html"
} else {
  Join-Path $outputPath "game.js"
}

if (-not (Test-Path -LiteralPath $creator -PathType Leaf)) {
  throw "Cocos Creator 3.8.8 was not found at $creator"
}
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "Build configuration was not found at $configPath"
}

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$buildArgument = "configPath=$configPath;logDest=$logPath"
$buildStartedAt = [DateTime]::UtcNow
$process = Start-Process -FilePath $creator -ArgumentList @(
  "--project", $projectPath,
  "--build", $buildArgument
) -Wait -PassThru

$logFinished = $false
if (Test-Path -LiteralPath $logPath) {
  $logFile = Get-Item -LiteralPath $logPath
  $logIsFresh = $logFile.LastWriteTimeUtc -ge $buildStartedAt.AddSeconds(-1)
  $logFinished = $logIsFresh -and [bool](Select-String -LiteralPath $logPath -SimpleMatch "build Task ($Target) Finished" -Quiet)
}

if (($process.ExitCode -eq 36 -or $logFinished) -and (Test-Path -LiteralPath $entryPath -PathType Leaf)) {
  Write-Host "Cocos build succeeded for $Target (Creator exit code $($process.ExitCode) normalized after output verification)."
  Write-Host "Output: $outputPath"
  Write-Host "Log: $logPath"
  exit 0
}

if (Test-Path -LiteralPath $logPath) {
  Get-Content -LiteralPath $logPath -Tail 80
}
throw "Cocos build failed for $Target with exit code $($process.ExitCode)."
