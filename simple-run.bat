@echo off
echo 🚀 Simple Supplier Generator
echo.
pip install -r scripts\requirements.txt >nul 2>&1
python scripts\simple-generator.py
echo.
pause