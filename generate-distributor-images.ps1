# Distributor Product Image Generator
# PowerShell version

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Distributor Product Image Generator" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will generate images for the first 10 products" -ForegroundColor Yellow
Write-Host "of each distributor using AI image generation." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to continue or Ctrl+C to cancel..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Write-Host ""

npm run images:distributors

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Generation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check distributor-image-generation.log for details." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
