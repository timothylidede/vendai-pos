#!/usr/bin/env python3
"""
Simple Icon Generator for VendAI POS (Windows compatible)
Creates basic PNG icons in various sizes that can be converted to ICO/ICNS later.

Requirements:
    pip install Pillow

Usage:
    python simple_icon_generator.py
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Missing required package. Install with:")
    print("pip install Pillow")
    sys.exit(1)

# Icon sizes needed
SIZES = [16, 32, 48, 64, 128, 256, 512]

def create_vendai_icon(size):
    """Create a simple VendAI icon programmatically"""
    # Create image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate sizes based on image size
    padding = size // 10
    radius = size // 8
    
    # Background gradient (approximated with solid color)
    bg_color = (102, 126, 234, 255)  # #667eea
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=radius,
        fill=bg_color
    )
    
    # Main "V" letter
    v_size = size // 2
    v_thickness = max(2, size // 20)
    v_x = size // 2
    v_y = size // 4
    
    # Draw "V" shape
    draw.polygon([
        (v_x - v_size//3, v_y),
        (v_x - v_size//6, v_y),
        (v_x, v_y + v_size//2),
        (v_x + v_size//6, v_y),
        (v_x + v_size//3, v_y),
        (v_x + v_thickness, v_y + v_thickness),
        (v_x, v_y + v_size//2 - v_thickness),
        (v_x - v_thickness, v_y + v_thickness)
    ], fill=(255, 255, 255, 255))
    
    # Simple POS terminal shape at bottom
    terminal_width = size // 3
    terminal_height = size // 6
    terminal_x = size // 2 - terminal_width // 2
    terminal_y = size - size // 3
    
    draw.rectangle([
        terminal_x, terminal_y,
        terminal_x + terminal_width, terminal_y + terminal_height
    ], fill=(255, 255, 255, 200))
    
    # Small screen on terminal
    screen_padding = max(1, size // 50)
    draw.rectangle([
        terminal_x + screen_padding, terminal_y + screen_padding,
        terminal_x + terminal_width - screen_padding, terminal_y + terminal_height // 2
    ], fill=(30, 30, 30, 255))
    
    return img

def main():
    script_dir = Path(__file__).parent
    
    print("🎨 VendAI POS Simple Icon Generator")
    print(f"Output directory: {script_dir}")
    print()
    
    success_count = 0
    
    # Generate PNG files
    for size in SIZES:
        try:
            icon = create_vendai_icon(size)
            filename = f"icon-{size}.png"
            filepath = script_dir / filename
            
            icon.save(filepath, 'PNG')
            print(f"✓ Created {filename} ({size}x{size})")
            success_count += 1
            
        except Exception as e:
            print(f"✗ Failed to create icon-{size}.png: {e}")
    
    # Create main icon.png (512x512)
    try:
        main_icon = create_vendai_icon(512)
        main_path = script_dir / "icon.png"
        main_icon.save(main_path, 'PNG')
        print(f"✓ Created icon.png (512x512)")
        success_count += 1
    except Exception as e:
        print(f"✗ Failed to create icon.png: {e}")
    
    print()
    print(f"📊 Summary: {success_count}/{len(SIZES) + 1} icons created successfully")
    
    if success_count > 0:
        print()
        print("📝 Next steps:")
        print("1. Convert PNGs to ICO using online tool: https://convertio.co/png-ico/")
        print("2. Convert PNGs to ICNS using online tool: https://convertio.co/png-icns/")
        print("3. Or use ImageMagick: magick convert icon-*.png icon.ico")
        print("4. Update electron-builder.json to point to generated icons")
    
    return success_count > 0

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)