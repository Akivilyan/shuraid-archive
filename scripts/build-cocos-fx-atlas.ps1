param(
  [string]$OutputPath = "M:\codex\GameOne\luanshi-survivor\cocos-client\assets\resources\art\battle-fx-atlas.png"
)

Add-Type -AssemblyName System.Drawing

$bitmap = New-Object System.Drawing.Bitmap 640, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

try {
  foreach ($layer in @(
    @{ Alpha = 18; X = 12; Y = 49; W = 104; H = 30 },
    @{ Alpha = 22; X = 18; Y = 53; W = 92; H = 22 },
    @{ Alpha = 28; X = 26; Y = 57; W = 76; H = 14 }
  )) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($layer.Alpha, 20, 18, 14))
    $graphics.FillEllipse($brush, $layer.X, $layer.Y, $layer.W, $layer.H)
    $brush.Dispose()
  }

  $bladeGlow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 139, 255, 175)), 20
  $bladeGlow.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bladeGlow.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($bladeGlow, 142, 20, 102, 92, 204, 112)
  $bladeGlow.Dispose()
  $bladeCore = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(232, 209, 255, 224)), 7
  $bladeCore.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bladeCore.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($bladeCore, 142, 20, 102, 92, 204, 112)
  $bladeCore.Dispose()

  foreach ($ring in @(
    @{ Alpha = 74; Width = 12; Inset = 16 },
    @{ Alpha = 150; Width = 5; Inset = 24 },
    @{ Alpha = 220; Width = 2; Inset = 31 }
  )) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($ring.Alpha, 226, 250, 255)), $ring.Width
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $diameter = 128 - $ring.Inset * 2
    $graphics.DrawArc($pen, 256 + $ring.Inset, $ring.Inset, $diameter, $diameter, 18, 292)
    $pen.Dispose()
  }

  foreach ($line in @(
    @{ Alpha = 165; Y = 42; Width = 3 },
    @{ Alpha = 110; Y = 58; Width = 2 },
    @{ Alpha = 80; Y = 76; Width = 2 },
    @{ Alpha = 55; Y = 91; Width = 1 }
  )) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($line.Alpha, 255, 230, 126)), $line.Width
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawBezier($pen, 393, $line.Y, 421, $line.Y - 13, 470, $line.Y + 12, 503, $line.Y - 3)
    $pen.Dispose()
  }

  $panelPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $panelPath.AddArc(518, 6, 24, 24, 180, 90)
  $panelPath.AddArc(614, 6, 24, 24, 270, 90)
  $panelPath.AddArc(614, 98, 24, 24, 0, 90)
  $panelPath.AddArc(518, 98, 24, 24, 90, 90)
  $panelPath.CloseFigure()
  $panelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $graphics.FillPath($panelBrush, $panelPath)
  $panelBrush.Dispose()
  $panelPath.Dispose()

  $directory = Split-Path -Parent $OutputPath
  if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Built Cocos battle FX atlas: $OutputPath"

