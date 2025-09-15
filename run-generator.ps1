# Simple Supplier Data Generator - PowerShell
Write-Host "🚀 Starting Supplier Data Generation..." -ForegroundColor Cyan
Write-Host ""

# Check Python
try {
    $version = python --version 2>&1
    Write-Host "✓ Found Python: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Install from python.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
pip install -r scripts\requirements.txt | Out-Null

Write-Host ""
Write-Host "🤖 Running generator (API key from .env.local)..." -ForegroundColor Cyan
python scripts\generate-supplier-products.py

Write-Host ""
Write-Host "✅ Complete! Check data\generated\ for results." -ForegroundColor Green
Read-Host "Press Enter to exit"