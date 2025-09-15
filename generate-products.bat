@echo off
REM Supplier Product Data Generator - Windows Batch Script
REM This script processes supplier pricelists using OpenAI API

echo =============================================
echo Supplier Product Data Generator
echo =============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Please install Python 3.8 or later.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if pip is available
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: pip not found. Please ensure pip is installed with Python.
    pause
    exit /b 1
)

echo Installing Python dependencies...
pip install -r scripts\requirements.txt

echo.
echo Dependencies installed successfully!
echo.

REM Check if OPENAI_API_KEY is set
if "%OPENAI_API_KEY%"=="" (
    echo WARNING: OPENAI_API_KEY environment variable not set.
    echo You can:
    echo 1. Set the environment variable: set OPENAI_API_KEY=your_key_here
    echo 2. Pass it as argument: python scripts\generate-supplier-products.py --api-key your_key_here
    echo.
    set /p continue="Continue anyway? (y/N): "
    if /i not "%continue%"=="y" (
        echo Exiting...
        pause
        exit /b 1
    )
)

echo Starting product data generation...
echo.

python scripts\generate-supplier-products.py %*

echo.
echo Process completed!
echo Check the data\generated\ folder for output files.
echo.
pause