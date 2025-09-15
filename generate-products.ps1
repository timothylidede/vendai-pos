# Supplier Product Data Generator - PowerShell Script
# This script processes supplier pricelists using OpenAI API

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Supplier Product Data Generator" -ForegroundColor Cyan  
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found. Please install Python 3.8 or later." -ForegroundColor Red
    Write-Host "Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pip is available
try {
    $pipVersion = pip --version 2>&1
    Write-Host "Found: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: pip not found. Please ensure pip is installed with Python." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
try {
    pip install -r scripts\requirements.txt
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to install dependencies." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if OPENAI_API_KEY is set
if (-not $env:OPENAI_API_KEY) {
    Write-Host "WARNING: OPENAI_API_KEY environment variable not set." -ForegroundColor Yellow
    Write-Host "You can:" -ForegroundColor Yellow
    Write-Host "1. Set the environment variable: `$env:OPENAI_API_KEY='your_key_here'" -ForegroundColor Yellow
    Write-Host "2. Pass it as argument when running the script" -ForegroundColor Yellow
    Write-Host ""
    
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        Write-Host "Exiting..." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "Starting product data generation..." -ForegroundColor Cyan
Write-Host ""

# Run the Python script with all passed arguments
try {
    python scripts\generate-supplier-products.py $args
    Write-Host ""
    Write-Host "Process completed successfully!" -ForegroundColor Green
    Write-Host "Check the data\generated\ folder for output files." -ForegroundColor Yellow
} catch {
    Write-Host "ERROR: Script execution failed." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to exit"