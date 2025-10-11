#!/usr/bin/env pwsh
# Quick test script for receiving flow
# Run from project root: .\test-receiving-flow.ps1

Write-Host "🧪 Testing Supplier Receiving Flow" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if required files exist
$files = @(
    "types\purchase-orders.ts",
    "lib\purchase-order-operations.ts",
    "app\api\supplier\purchase-orders\route.ts",
    "app\api\supplier\receiving\route.ts",
    "components\modules\receiving-modal.tsx"
)

Write-Host "✓ Checking files..." -ForegroundColor Yellow
$allExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (missing)" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host ""
    Write-Host "❌ Some files are missing. Please check the implementation." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ All files present" -ForegroundColor Green
Write-Host ""

# Check TypeScript compilation
Write-Host "✓ Checking TypeScript..." -ForegroundColor Yellow
$tscCheck = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ No TypeScript errors" -ForegroundColor Green
} else {
    Write-Host "  ⚠ TypeScript errors found:" -ForegroundColor Yellow
    Write-Host $tscCheck -ForegroundColor Gray
}

Write-Host ""
Write-Host "✓ Deploy Firestore indexes:" -ForegroundColor Yellow
Write-Host "  firebase deploy --only firestore:indexes" -ForegroundColor Cyan
Write-Host ""

Write-Host "✓ Manual Test Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Start dev server: npm run dev" -ForegroundColor White
Write-Host "  2. Navigate to Supplier Module" -ForegroundColor White
Write-Host "  3. Add products to cart from a supplier" -ForegroundColor White
Write-Host "  4. Click cart icon and 'Place Order'" -ForegroundColor White
Write-Host "  5. Note the PO ID from success toast" -ForegroundColor White
Write-Host "  6. Click 'Receive' button in header" -ForegroundColor White
Write-Host "  7. Enter PO number and confirm receipt" -ForegroundColor White
Write-Host "  8. Verify inventory updated in Inventory Module" -ForegroundColor White
Write-Host ""

Write-Host "✓ API Test Commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  # Create PO (requires auth token):" -ForegroundColor White
Write-Host '  curl -X POST http://localhost:3000/api/supplier/purchase-orders \' -ForegroundColor Cyan
Write-Host '    -H "Content-Type: application/json" \' -ForegroundColor Cyan
Write-Host '    -d @test-po.json' -ForegroundColor Cyan
Write-Host ""
Write-Host "  # Receive delivery:" -ForegroundColor White
Write-Host '  curl -X POST http://localhost:3000/api/supplier/receiving \' -ForegroundColor Cyan
Write-Host '    -H "Content-Type: application/json" \' -ForegroundColor Cyan
Write-Host '    -d @test-receiving.json' -ForegroundColor Cyan
Write-Host ""

Write-Host "📖 Documentation: docs\RECEIVING_FLOW_IMPLEMENTATION.md" -ForegroundColor Magenta
Write-Host ""
Write-Host "✅ Ready for testing!" -ForegroundColor Green
