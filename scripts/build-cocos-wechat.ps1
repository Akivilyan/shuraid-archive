$ErrorActionPreference = "Stop"

$creatorPath = "C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe"
$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $PSScriptRoot "cocos-build-config\wechatgame.json"
$outputPath = Join-Path $projectRoot "build\wechatgame"
$logDirectory = Join-Path $projectRoot "output\cocos-build-logs"
$logPath = Join-Path $logDirectory "wechatgame.log"

if (-not (Test-Path -LiteralPath $creatorPath -PathType Leaf)) {
  throw "Cocos Creator 3.8.8 was not found at $creatorPath"
}
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "WeChat build configuration was not found at $configPath"
}

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$buildArgument = "configPath=$configPath;logDest=$logPath"
$process = Start-Process -FilePath $creatorPath -ArgumentList @(
  "--project", $projectRoot,
  "--build", $buildArgument
) -Wait -PassThru -WindowStyle Hidden

if ($process.ExitCode -ne 36 -and $process.ExitCode -ne 0) {
  if (Test-Path -LiteralPath $logPath -PathType Leaf) {
    Get-Content -LiteralPath $logPath -Tail 100
  }
  throw "Cocos WeChat build failed with exit code $($process.ExitCode)."
}

$requiredOutputs = @(
  (Join-Path $outputPath "game.js"),
  (Join-Path $outputPath "project.config.json"),
  (Join-Path $outputPath "src\settings.json")
)
foreach ($requiredOutput in $requiredOutputs) {
  if (-not (Test-Path -LiteralPath $requiredOutput -PathType Leaf)) {
    throw "Cocos reported success but required output is missing: $requiredOutput"
  }
}

$projectConfig = Get-Content -LiteralPath (Join-Path $outputPath "project.config.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$settings = Get-Content -LiteralPath (Join-Path $outputPath "src\settings.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$resolution = $settings.screen.designResolution
if ($resolution.width -ne 390 -or $resolution.height -ne 844 -or $resolution.policy -ne 3) {
  throw "Unexpected design resolution in generated WeChat build."
}

Write-Host "Cocos WeChat Debug build succeeded."
Write-Host "AppID: $($projectConfig.appid)"
Write-Host "Design resolution: $($resolution.width)x$($resolution.height), policy $($resolution.policy)"
Write-Host "Output: $outputPath"
Write-Host "Log: $logPath"
exit 0
