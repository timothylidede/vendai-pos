@echo off
REM Enhanced Product Extraction and Image Generation
REM Run with: generate-products-enhanced.bat

echo ================================================
echo Enhanced Product Extraction ^& Image Generation
echo ================================================
echo.

REM Step 1: Extract products with enhanced AI
echo Step 1: Extracting products from PDFs...
echo Features: Better brand extraction, Title Case names, Single price
echo.

set /p extractChoice="Run extraction? (y/n/clear-cache): "
if "%extractChoice%"=="y" (
    call npm run extract:products
) else if "%extractChoice%"=="clear-cache" (
    echo Clearing cache and re-extracting...
    call npm run extract:products -- --clear-cache
)

echo.
echo ================================================
echo.

REM Step 2: Generate images with FAL.ai
echo Step 2: Generate product images with FAL.ai...
echo Features: Multiple references, Category-specific prompts, 90%% cheaper
echo.

set /p imageChoice="Generate images for which distributor? (sam-west/mahitaji/skip): "
if "%imageChoice%"=="sam-west" (
    goto generate_images
)
if "%imageChoice%"=="mahitaji" (
    goto generate_images
)
goto end

:generate_images
set /p limit="How many images to generate? (default: 50): "
if "%limit%"=="" set limit=50

set /p regen="Regenerate existing images? (y/n): "
if "%regen%"=="y" (
    call tsx scripts/generate-distributor-images-fal.ts %imageChoice% %limit% --regenerate
) else (
    call tsx scripts/generate-distributor-images-fal.ts %imageChoice% %limit%
)

:end
echo.
echo ================================================
echo Process Complete!
echo ================================================
echo.
echo Next steps:
echo 1. Review generated products in data/distributors/
echo 2. Check Firestore 'distributor_images' collection
echo 3. Test in the supplier module
echo.
pause
