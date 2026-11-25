# Exporta el icono Android y el símbolo que sustituye la marca de la esquina superior.
# Ejecutar en Windows: pwsh -File scripts/generate-brand-assets.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$frontendRoot = Split-Path -Parent $PSScriptRoot
$brandSource = Join-Path $frontendRoot 'resources/branding'
$brandAssets = Join-Path $frontendRoot 'src/assets/branding'
$androidRes = Join-Path $frontendRoot 'android/app/src/main/res'

function Export-BrandImage {
    param([string]$Source, [string]$Destination, [int]$Width, [int]$Height, [double]$Fill = 0.85, [bool]$Transparent = $true, [bool]$Round = $false)
    $sourceBitmap = [System.Drawing.Bitmap]::new($Source)
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        if ($Round) {
            $graphics.FillEllipse([System.Drawing.Brushes]::White, 0, 0, $Width, $Height)
        } elseif (-not $Transparent) {
            $graphics.Clear([System.Drawing.Color]::White)
        }
        $scale = [Math]::Min($Width / $sourceBitmap.Width, $Height / $sourceBitmap.Height) * $Fill
        $drawWidth = [single]($sourceBitmap.Width * $scale)
        $drawHeight = [single]($sourceBitmap.Height * $scale)
        $target = [System.Drawing.RectangleF]::new(($Width - $drawWidth) / 2, ($Height - $drawHeight) / 2, $drawWidth, $drawHeight)
        $graphics.DrawImage($sourceBitmap, $target)
        [System.IO.Directory]::CreateDirectory((Split-Path -Parent $Destination)) | Out-Null
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
        $sourceBitmap.Dispose()
    }
}

$symbol = Join-Path $brandSource 'safealert-symbol.png'
Export-BrandImage $symbol (Join-Path $brandAssets 'safealert-symbol.png') 320 320 1
Export-BrandImage $symbol (Join-Path $brandSource 'safealert-icon-512.png') 512 512 0.9 $false

$densities = @{ 'mdpi' = 1; 'hdpi' = 1.5; 'xhdpi' = 2; 'xxhdpi' = 3; 'xxxhdpi' = 4 }
foreach ($density in $densities.GetEnumerator()) {
    $folder = Join-Path $androidRes ('mipmap-' + $density.Key)
    $legacySize = [int](48 * $density.Value)
    $adaptiveSize = [int](108 * $density.Value)
    Export-BrandImage $symbol (Join-Path $folder 'ic_launcher.png') $legacySize $legacySize 0.9 $false
    Export-BrandImage $symbol (Join-Path $folder 'ic_launcher_round.png') $legacySize $legacySize 0.85 $true $true
    # La imagen fuente ya tiene margen. Este factor sitúa el símbolo completo dentro de 66 dp.
    Export-BrandImage $symbol (Join-Path $folder 'ic_launcher_foreground.png') $adaptiveSize $adaptiveSize 0.62
}

Write-Output 'Iconos Android y símbolo de la esquina superior generados. No se añaden logos a otras vistas.'
