@echo off
echo VendAI POS Icon Generator
echo ========================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Check if required packages are installed
echo Checking required packages...
python -c "import PIL, cairosvg" >nul 2>&1
if errorlevel 1 (
    echo Installing required packages...
    pip install Pillow cairosvg
    if errorlevel 1 (
        echo Error: Failed to install required packages
        pause
        exit /b 1
    )
)

REM Run the icon generator
echo.
echo Generating icons...
python generate_icons.py

echo.
echo Icon generation complete!
echo Check the build/icons directory for generated files.
echo.
pause