@echo off
echo ============================================
echo Distributor Product Image Generator
echo ============================================
echo.
echo This script will generate images for the first 10 products
echo of each distributor using AI image generation.
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul
echo.

npm run images:distributors

echo.
echo ============================================
echo Generation Complete!
echo ============================================
echo.
echo Check distributor-image-generation.log for details.
echo.
pause
