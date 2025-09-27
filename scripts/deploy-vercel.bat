@echo off
REM VendAI POS - Vercel Deployment Script
REM This script deploys your project to Vercel for hosting at app.vendai.digital

echo.
echo ================================
echo VendAI POS - Vercel Deployment
echo ================================
echo.

REM Check if we're in the right directory
if not exist package.json (
    echo ❌ Error: package.json not found. Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Vercel CLI not found. Installing...
    npm install -g vercel
    if %errorlevel% neq 0 (
        echo ❌ Failed to install Vercel CLI
        pause
        exit /b 1
    )
    echo ✅ Vercel CLI installed successfully
) else (
    echo ✅ Vercel CLI found
)

echo.
echo 📋 Pre-deployment checklist:
echo - Ensure your .env.local file has all required Firebase credentials
echo - Make sure your Firebase project is configured for production
echo - Verify your Google OAuth client supports app.vendai.digital domain
echo.

REM Ask for confirmation
set /p confirmation="Do you want to proceed with deployment? (y/N): "
if /i not "%confirmation%"=="y" (
    echo Deployment cancelled.
    pause
    exit /b 0
)

echo.
echo 📦 Building and deploying to Vercel...

REM Deploy to production
vercel --prod

if %errorlevel% equ 0 (
    echo.
    echo ✅ Deployment completed successfully!
    echo.
    echo 🌍 Your app is now live at:
    echo - Production URL: https://app.vendai.digital ^(once DNS is configured^)
    echo - Vercel URL: Check the output above
    echo.
    echo 🔗 API Endpoints available:
    echo - Latest Release: https://app.vendai.digital/api/releases/latest
    echo - Update Check: https://app.vendai.digital/api/releases/check-update
    echo.
    echo 📋 Next steps:
    echo 1. Configure your domain ^(app.vendai.digital^) in Vercel dashboard
    echo 2. Update your main vendai.digital site to redirect login to app.vendai.digital
    echo 3. Test the authentication flow
    echo 4. Update Firebase OAuth settings to include app.vendai.digital
    echo.
) else (
    echo.
    echo ❌ Deployment failed. Please check the error messages above.
)

pause