# VendAI POS Icons

This directory contains the application icons for different platforms.

## Icon Requirements

### Windows (.ico)
- `icon.ico` - Main Windows icon (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)

### macOS (.icns)
- `icon.icns` - macOS icon bundle (1024x1024 down to 16x16)

### Linux (.png)
- `icon.png` - Linux application icon (typically 512x512 or 256x256)

## Icon Sizes Needed

- 1024x1024 (macOS, high-res displays)
- 512x512 (Linux, general use)
- 256x256 (Windows, standard)
- 128x128 (Windows, medium)
- 64x64 (Windows, small)
- 48x48 (Windows, taskbar)
- 32x32 (Windows, small taskbar)
- 16x16 (Windows, system tray)

## Design Guidelines

The VendAI POS icon should:
- Use the brand colors: Primary #667eea, Secondary #764ba2
- Be recognizable at small sizes
- Work on both light and dark backgrounds
- Represent POS/retail/AI concepts

## Creating Icons

You can use the provided SVG template and convert it using:

1. **Online tools**: Convert SVG to ICO, ICNS, PNG
2. **ImageMagick**: 
   ```bash
   magick convert icon.svg -resize 256x256 icon.png
   magick convert icon.svg icon.ico
   ```
3. **iconutil** (macOS): Convert iconset to icns
4. **Electron Builder**: Auto-generates from single high-res PNG

## Current Status

- SVG template created ✓
- Needs conversion to platform formats
- electron-builder.json configured for auto-generation