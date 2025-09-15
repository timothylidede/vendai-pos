@echo off
REM Simple Supplier Data Generator
echo Starting supplier data generation...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Please install Python from python.org
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "scripts\venv" (
    echo Installing dependencies...
    pip install -r scripts\requirements.txt
    echo.
)

REM Run the script - it will automatically load API key from .env.local
echo Running product data generator...
python scripts\generate-supplier-products.py

echo.
echo Done! Check data\generated\ folder for results.
pause