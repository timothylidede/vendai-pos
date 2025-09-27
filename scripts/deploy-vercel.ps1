#!/usr/bin/env pwsh

# VendAI POS - Vercel Deployment Script
# This script deploys your project to Vercel for hosting at app.vendai.digital

Write-Host "🚀 VendAI POS - Vercel Deployment" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

# Check if Vercel CLI is installed
try {
    $vercelVersion = vercel --version 2>$null
    if ($?) {
        Write-Host "✅ Vercel CLI found: $vercelVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Vercel CLI installed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install Vercel CLI" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📋 Pre-deployment checklist:" -ForegroundColor Yellow
Write-Host "- Ensure your .env.local file has all required Firebase credentials" -ForegroundColor Gray
Write-Host "- Make sure your Firebase project is configured for production" -ForegroundColor Gray
Write-Host "- Verify your Google OAuth client supports app.vendai.digital domain" -ForegroundColor Gray
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Do you want to proceed with deployment? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "📦 Building and deploying to Vercel..." -ForegroundColor Blue

# Deploy to production
vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌍 Your app is now live at:" -ForegroundColor Cyan
    Write-Host "- Production URL: https://app.vendai.digital (once DNS is configured)" -ForegroundColor White
    Write-Host "- Vercel URL: Check the output above" -ForegroundColor White
    Write-Host ""
    Write-Host "🔗 API Endpoints available:" -ForegroundColor Cyan
    Write-Host "- Latest Release: https://app.vendai.digital/api/releases/latest" -ForegroundColor White
    Write-Host "- Update Check: https://app.vendai.digital/api/releases/check-update" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Configure your domain (app.vendai.digital) in Vercel dashboard" -ForegroundColor Gray
    Write-Host "2. Update your main vendai.digital site to redirect login to app.vendai.digital" -ForegroundColor Gray
    Write-Host "3. Test the authentication flow" -ForegroundColor Gray
    Write-Host "4. Update Firebase OAuth settings to include app.vendai.digital" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")