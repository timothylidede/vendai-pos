@echo off
echo 🚀 Deploying VendAI POS to Vercel...

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI not found. Installing...
    npm install -g vercel
)

REM Deploy to Vercel
echo 📦 Building and deploying...
vercel --prod

echo ✅ Deployment complete!
echo.
echo 📋 Next steps:
echo 1. Copy the deployment URL from above
echo 2. Update your vendai-website project to use that URL  
echo 3. Test the API endpoints:
echo    - https://YOUR-URL.vercel.app/api/releases/latest
echo    - https://YOUR-URL.vercel.app/api/releases/check-update
echo.
echo 🔗 Use this URL in your vendai-website project:
echo const API_BASE_URL = 'https://YOUR-URL.vercel.app';

pause