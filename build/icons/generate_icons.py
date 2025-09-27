#!/usr/bin/env python3
"""
Icon Generator for VendAI POS
Converts the SVG icon to various formats needed for different platforms.

Requirements:
    pip install Pillow cairosvg

Usage:
    python generate_icons.py
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
    import cairosvg
except ImportError:
    print("Missing required packages. Install with:")
    print("pip install Pillow cairosvg")
    sys.exit(1)

# Icon sizes needed for different platforms
SIZES = {
    'icon.png': 512,  # Main icon (Linux, general use)
    'icon-256.png': 256,  # Windows medium
    'icon-128.png': 128,  # Windows small
    'icon-64.png': 64,    # Windows smaller
    'icon-48.png': 48,    # Windows taskbar
    'icon-32.png': 32,    # Windows small taskbar
    'icon-16.png': 16,    # Windows system tray
}

def convert_svg_to_png(svg_path, output_path, size):
    """Convert SVG to PNG at specified size"""
    try:
        cairosvg.svg2png(
            url=str(svg_path),
            write_to=str(output_path),
            output_width=size,
            output_height=size
        )
        print(f"✓ Created {output_path.name} ({size}x{size})")
        return True
    except Exception as e:
        print(f"✗ Failed to create {output_path.name}: {e}")
        return False

def create_ico_from_pngs(png_files, ico_path):
    """Create Windows ICO file from multiple PNG files"""
    try:
        images = []
        for png_file in png_files:
            if png_file.exists():
                img = Image.open(png_file)
                images.append(img)
        
        if images:
            images[0].save(
                str(ico_path),
                format='ICO',
                sizes=[(img.width, img.height) for img in images]
            )
            print(f"✓ Created {ico_path.name} with {len(images)} sizes")
            return True
        else:
            print(f"✗ No PNG files found for ICO creation")
            return False
    except Exception as e:
        print(f"✗ Failed to create {ico_path.name}: {e}")
        return False

def main():
    # Get script directory
    script_dir = Path(__file__).parent
    svg_file = script_dir / 'icon.svg'
    
    if not svg_file.exists():
        print(f"✗ SVG file not found: {svg_file}")
        return False
    
    print(f"🎨 VendAI POS Icon Generator")
    print(f"Source SVG: {svg_file}")
    print(f"Output directory: {script_dir}")
    print()
    
    # Convert SVG to various PNG sizes
    png_files = []
    success_count = 0
    
    for filename, size in SIZES.items():
        output_path = script_dir / filename
        if convert_svg_to_png(svg_file, output_path, size):
            png_files.append(output_path)
            success_count += 1
    
    print()
    
    # Create Windows ICO file from PNGs
    ico_path = script_dir / 'icon.ico'
    ico_pngs = [f for f in png_files if f.name.endswith('.png')]
    if create_ico_from_pngs(ico_pngs, ico_path):
        success_count += 1
    
    print()
    print(f"📊 Summary: {success_count}/{len(SIZES) + 1} icons created successfully")
    
    if success_count > 0:
        print()
        print("📝 Next steps:")
        print("1. For macOS .icns file, use iconutil or online converter")
        print("2. Update electron-builder.json to point to generated icons")
        print("3. Test icons in built applications")
    
    return success_count > 0

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)