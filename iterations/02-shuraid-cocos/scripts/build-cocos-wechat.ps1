param(
  [ValidateSet("Debug", "Release")]
  [string]$Mode = "Debug"
)

$ErrorActionPreference = "Stop"

$creatorPath = "C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe"
$projectRoot = Split-Path -Parent $PSScriptRoot
$isDebugBuild = $Mode -eq "Debug"
$configFileName = if ($isDebugBuild) { "wechatgame.json" } else { "wechatgame-release.json" }
$outputName = if ($isDebugBuild) { "wechatgame" } else { "wechatgame-release" }
$configPath = Join-Path $PSScriptRoot "cocos-build-config\$configFileName"
$engineSettingsPath = Join-Path $projectRoot "settings\v2\packages\engine.json"
$outputPath = Join-Path $projectRoot "build\$outputName"
$entryPath = Join-Path $outputPath "game.js"
$projectConfigPath = Join-Path $outputPath "project.config.json"
$engineBundlePath = Join-Path $outputPath "cocos-js\cc.js"
$generatedSettingsPath = Join-Path $outputPath "src\settings.json"
$logDirectory = Join-Path $projectRoot "output\cocos-build-logs"
$logPath = Join-Path $logDirectory "$outputName.log"
$expectedAppId = "wxc99662ee0bfded03"

if (-not (Test-Path -LiteralPath $creatorPath -PathType Leaf)) {
  throw "Cocos Creator 3.8.8 was not found at $creatorPath"
}
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "WeChat build configuration was not found at $configPath"
}
if (-not (Test-Path -LiteralPath $engineSettingsPath -PathType Leaf)) {
  throw "Cocos engine settings were not found at $engineSettingsPath"
}

$engineSettings = Get-Content -LiteralPath $engineSettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$engineCache = $engineSettings.modules.configs.defaultConfig.cache
$includedModules = $engineSettings.modules.configs.defaultConfig.includeModules
$requiredEngineModules = @("animation", "graphics", "tween")
foreach ($moduleName in $requiredEngineModules) {
  $moduleEntry = $engineCache.PSObject.Properties[$moduleName]
  if ($null -eq $moduleEntry -or $moduleEntry.Value._value -ne $true) {
    throw "Required Cocos engine module is disabled: $moduleName"
  }
  if ($includedModules -notcontains $moduleName) {
    throw "Required Cocos engine module is missing from includeModules: $moduleName"
  }
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
if (-not (Test-Path -LiteralPath $engineBundlePath -PathType Leaf)) {
  throw "The generated Cocos engine bundle is missing at $engineBundlePath"
}
if (-not (Test-Path -LiteralPath $generatedSettingsPath -PathType Leaf)) {
  throw "The generated Cocos settings file is missing at $generatedSettingsPath"
}

$generatedConfig = Get-Content -LiteralPath $projectConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($generatedConfig.appid -ne $expectedAppId) {
  throw "Generated AppID mismatch: expected $expectedAppId but found $($generatedConfig.appid)"
}

$generatedSettings = Get-Content -LiteralPath $generatedSettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($generatedSettings.engine.debug -ne $isDebugBuild) {
  throw "Generated debug mode mismatch: expected $isDebugBuild but found $($generatedSettings.engine.debug)"
}
$designResolution = $generatedSettings.screen.designResolution
if (
  ($designResolution.width -ne 390) -or
  ($designResolution.height -ne 844) -or
  ($designResolution.policy -ne 3)
) {
  throw "Generated design resolution mismatch: expected 390x844 policy 3."
}

$engineBundle = Get-Content -LiteralPath $engineBundlePath -Raw -Encoding UTF8
$requiredEngineExports = @(
  @{ Name = "Animation"; Marker = "exports({ Animation: Animation" }
  @{ Name = "AnimationClip"; Marker = 'exports("AnimationClip"' }
  @{ Name = "Graphics"; Marker = "Graphics: Graphics" }
  @{ Name = "Tween"; Marker = 'exports("Tween"' }
  @{ Name = "tween"; Marker = "tween: tween" }
)
if ($isDebugBuild) {
  foreach ($requiredExport in $requiredEngineExports) {
    if (-not $engineBundle.Contains($requiredExport.Marker)) {
      throw "Generated Cocos engine bundle is missing required export: $($requiredExport.Name)"
    }
  }
}

Write-Host "Cocos WeChat $Mode build succeeded."
Write-Host "AppID: $($generatedConfig.appid)"
Write-Host "Debug: $($generatedSettings.engine.debug)"
Write-Host "Design resolution: $($designResolution.width)x$($designResolution.height), policy $($designResolution.policy)"
Write-Host "Engine modules: $($requiredEngineModules -join ', ')"
Write-Host "Output: $outputPath"
Write-Host "Log: $logPath"
exit 0
