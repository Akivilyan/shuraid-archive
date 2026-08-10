$ErrorActionPreference = "Stop"

$creatorPath = "C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe"
$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $PSScriptRoot "cocos-build-config\wechatgame.json"
$outputPath = Join-Path $projectRoot "build\wechatgame"
$entryPath = Join-Path $outputPath "game.js"
$projectConfigPath = Join-Path $outputPath "project.config.json"
$logDirectory = Join-Path $projectRoot "output\cocos-build-logs"
$logPath = Join-Path $logDirectory "wechatgame.log"
$expectedAppId = "wxc99662ee0bfded03"

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
    Get-Content -LiteralPath $logPath -Tail 80
  }
  throw "Cocos WeChat build failed with exit code $($process.ExitCode)."
}
if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) {
  throw "Cocos reported success but the WeChat entry file is missing at $entryPath"
}
if (-not (Test-Path -LiteralPath $projectConfigPath -PathType Leaf)) {
  throw "The generated WeChat project configuration is missing at $projectConfigPath"
}

$generatedConfig = Get-Content -LiteralPath $projectConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($generatedConfig.appid -ne $expectedAppId) {
  throw "Generated AppID mismatch: expected $expectedAppId but found $($generatedConfig.appid)"
}

Write-Host "Cocos WeChat build succeeded."
Write-Host "AppID: $($generatedConfig.appid)"
Write-Host "Output: $outputPath"
Write-Host "Log: $logPath"
exit 0
