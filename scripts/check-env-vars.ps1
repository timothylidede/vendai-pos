# Check Environment Variables for CRLF issues
# Run this in PowerShell

Write-Host "`n🔍 Checking .env.local for issues...`n" -ForegroundColor Cyan

$envFile = ".env.local"
$hasIssues = $false

# Check if file exists
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env.local file not found!" -ForegroundColor Red
    exit 1
}

# Read file content
$content = Get-Content $envFile -Raw

# Check for CRLF in Firebase variables
$firebaseVars = @(
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID"
)

Write-Host "Checking Firebase environment variables:" -ForegroundColor Yellow
Write-Host "----------------------------------------`n"

foreach ($var in $firebaseVars) {
    # Extract the line with this variable
    $pattern = "$var=(.+)"
    if ($content -match $pattern) {
        $value = $matches[1]
        
        # Check for issues
        $containsCR = $value.Contains("`r")
        $containsLF = $value.Contains("`n")
        $hasCRLF = $containsCR -or $containsLF
        $trimmedValue = $value.Trim()
        $hasExtraSpace = $value -ne $trimmedValue
        
        if ($hasCRLF) {
            Write-Host "✗ $var" -ForegroundColor Red
            Write-Host "  Contains CRLF characters!" -ForegroundColor Red
            $displayValue = $value -replace "`r", '\r' -replace "`n", '\n'
            Write-Host "  Value: $displayValue`n" -ForegroundColor Yellow
            $hasIssues = $true
        }
        elseif ($hasExtraSpace) {
            Write-Host "⚠ $var" -ForegroundColor Yellow
            Write-Host "  Contains extra whitespace" -ForegroundColor Yellow
            Write-Host "  Value: '$value'`n" -ForegroundColor Yellow
            $hasIssues = $true
        }
        else {
            Write-Host "✓ $var" -ForegroundColor Green
            Write-Host "  Value: $trimmedValue`n" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "✗ $var" -ForegroundColor Red
        Write-Host "  NOT FOUND in .env.local`n" -ForegroundColor Red
        $hasIssues = $true
    }
}

Write-Host "`n----------------------------------------"
Write-Host "Summary:" -ForegroundColor Yellow

if ($hasIssues) {
    Write-Host "❌ Issues found in .env.local!" -ForegroundColor Red
    Write-Host "`nThe local file has been fixed. Now update Vercel:" -ForegroundColor Cyan
    Write-Host "1. Go to: https://vercel.com/timothylidede/vendai-pos/settings/environment-variables" -ForegroundColor White
    Write-Host "2. Update each flagged variable with the correct value" -ForegroundColor White
    Write-Host "3. Redeploy the application" -ForegroundColor White
    Write-Host "`nRun this script again after redeployment to verify.`n" -ForegroundColor Cyan
}
else {
    Write-Host "✅ All environment variables look good in .env.local!" -ForegroundColor Green
    Write-Host "`nNext: Verify they match in Vercel dashboard and redeploy.`n" -ForegroundColor Cyan
}
