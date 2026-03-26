# Install FFmpeg (required for Varin / ManimGL video merging)
# Run: .\scripts\install_ffmpeg.ps1

Write-Host "Installing FFmpeg..." -ForegroundColor Cyan

if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install FFmpeg --accept-package-agreements --accept-source-agreements
    Write-Host "FFmpeg installed via winget. Restart your terminal, then run: ffmpeg -version" -ForegroundColor Green
} elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install ffmpeg -y
    Write-Host "FFmpeg installed via Chocolatey. Restart your terminal, then run: ffmpeg -version" -ForegroundColor Green
} else {
    Write-Host "winget or Chocolatey not found. Install FFmpeg manually:" -ForegroundColor Yellow
    Write-Host "  1. Download from https://ffmpeg.org/download.html" -ForegroundColor Yellow
    Write-Host "  2. Or run: winget install FFmpeg (Windows 10/11)" -ForegroundColor Yellow
}
