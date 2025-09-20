@echo off
echo Testing VendAI POS Build System
echo ================================

echo Step 1: Cleaning previous build...
if exist dist rmdir /s /q dist
if exist .next rmdir /s /q .next

echo Step 2: Building Next.js application...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Next.js build failed
    exit /b 1
)

echo Step 3: Building Windows executable...
call npx electron-builder --win --x64 --publish=never
if %errorlevel% neq 0 (
    echo ERROR: Electron build failed
    exit /b 1
)

echo Step 4: Checking build output...
if exist dist (
    echo SUCCESS: Build completed!
    echo Contents of dist directory:
    dir dist /b
    echo.
    echo Looking for Windows installer:
    dir dist\*.exe /b 2>nul
    if %errorlevel% equ 0 (
        echo SUCCESS: Windows installer found!
    ) else (
        echo WARNING: No .exe installer found
    )
) else (
    echo ERROR: No dist directory created
    exit /b 1
)

echo.
echo Build test complete!
pause