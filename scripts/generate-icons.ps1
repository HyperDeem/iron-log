Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$publicDirectory = Join-Path $projectRoot "public"
$background = [System.Drawing.ColorTranslator]::FromHtml("#17201b")
$foreground = [System.Drawing.ColorTranslator]::FromHtml("#f3f4ef")
$accent = [System.Drawing.ColorTranslator]::FromHtml("#e05d32")

function New-RoundedPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-AppIcon {
    param(
        [int]$Size,
        [string]$OutputPath,
        [switch]$Maskable
    )

    $scale = $Size / 512.0
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($Maskable) {
        $graphics.Clear($background)
    } else {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $backgroundPath = New-RoundedPath 0 0 $Size $Size (104 * $scale)
        $backgroundBrush = [System.Drawing.SolidBrush]::new($background)
        $graphics.FillPath($backgroundBrush, $backgroundPath)
        $backgroundBrush.Dispose()
        $backgroundPath.Dispose()
    }

    $foregroundBrush = [System.Drawing.SolidBrush]::new($foreground)
    $accentBrush = [System.Drawing.SolidBrush]::new($accent)
    $parts = @(
        @(92, 228, 66, 56, 16, $false),
        @(354, 228, 66, 56, 16, $false),
        @(140, 204, 50, 104, 16, $false),
        @(322, 204, 50, 104, 16, $false),
        @(182, 244, 148, 24, 12, $false),
        @(224, 138, 64, 38, 10, $true),
        @(205, 176, 102, 38, 10, $true),
        @(224, 206, 64, 68, 10, $true),
        @(205, 244, 102, 38, 10, $true)
    )

    foreach ($part in $parts) {
        $x = [float]($part[0] * $scale)
        $y = [float]($part[1] * $scale)
        $width = [float]($part[2] * $scale)
        $height = [float]($part[3] * $scale)
        $radius = [float]($part[4] * $scale)
        $path = New-RoundedPath $x $y $width $height $radius
        $brush = if ($part[5]) { $accentBrush } else { $foregroundBrush }
        $graphics.FillPath($brush, $path)
        $path.Dispose()
    }

    $foregroundBrush.Dispose()
    $accentBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

New-AppIcon -Size 192 -OutputPath (Join-Path $publicDirectory "icon-192.png")
New-AppIcon -Size 512 -OutputPath (Join-Path $publicDirectory "icon-512.png")
New-AppIcon -Size 512 -OutputPath (Join-Path $publicDirectory "icon-maskable-512.png") -Maskable
New-AppIcon -Size 180 -OutputPath (Join-Path $publicDirectory "apple-touch-icon.png")
