# Enhanced Product Extraction and Image Generation
# Run with: .\generate-products-enhanced.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Enhanced Product Extraction & Image Generation" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Extract products with enhanced AI
Write-Host "Step 1: Extracting products from PDFs..." -ForegroundColor Yellow
Write-Host "Features: Better brand extraction, Title Case names, Single price" -ForegroundColor Gray
Write-Host ""

$extractChoice = Read-Host "Run extraction? (y/n/clear-cache)"
if ($extractChoice -eq "y") {
    npm run extract:products
} elseif ($extractChoice -eq "clear-cache") {
    Write-Host "Clearing cache and re-extracting..." -ForegroundColor Yellow
    npm run extract:products -- --clear-cache
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 2: Generate images with FAL.ai
Write-Host "Step 2: Generate product images with FAL.ai..." -ForegroundColor Yellow
Write-Host "Features: Multiple references, Category-specific prompts, 90% cheaper" -ForegroundColor Gray
Write-Host ""

$imageChoice = Read-Host "Generate images for which distributor? (sam-west/mahitaji/skip)"
if ($imageChoice -eq "sam-west" -or $imageChoice -eq "mahitaji") {
    $limit = Read-Host "How many images to generate? (default: 50)"
    if ([string]::IsNullOrWhiteSpace($limit)) { $limit = 50 }
    
    $regen = Read-Host "Regenerate existing images? (y/n)"
    if ($regen -eq "y") {
        tsx scripts/generate-distributor-images-fal.ts $imageChoice $limit --regenerate
    } else {
        tsx scripts/generate-distributor-images-fal.ts $imageChoice $limit
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Process Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review generated products in data/distributors/" -ForegroundColor Gray
Write-Host "2. Check Firestore 'distributor_images' collection" -ForegroundColor Gray
Write-Host "3. Test in the supplier module" -ForegroundColor Gray
Write-Host ""
