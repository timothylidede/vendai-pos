#!/usr/bin/env python3
"""
Simple Supplier Product Data Generator
Automatically loads OpenAI API key from .env.local
"""

import os
import json
import re
import PyPDF2
from pathlib import Path
from openai import OpenAI

# Load environment variables from .env.local
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env.local'
    load_dotenv(env_path)
    print(f"✓ Loaded API key from .env.local")
except ImportError:
    # Fallback to manual loading if python-dotenv not available
    env_path = Path(__file__).parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

def extract_pdf_text(pdf_path):
    """Extract text from PDF"""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"❌ Error reading {pdf_path}: {e}")
        return ""

def generate_products(supplier_name, text):
    """Use OpenAI to extract product data"""
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    prompt = f"""Extract product data from this {supplier_name} pricelist into JSON format.

For each product, extract:
- id: unique ID like "mah_001" 
- name: product name
- sku: product code (generate if missing)
- category: category like "Beverages", "Snacks", etc.
- unitPrice: price as number
- inStock: true
- minOrderQuantity: reasonable minimum (default 1)
- leadTime: like "1-2 days"

Limit to 30 clearest products. Return only JSON array:

{text[:10000]}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using cheaper model
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
            temperature=0.1
        )
        
        content = response.choices[0].message.content.strip()
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        
        if json_match:
            products = json.loads(json_match.group())
            return products
        else:
            print(f"⚠ Could not extract JSON from {supplier_name} response")
            return []
    except Exception as e:
        print(f"❌ Error processing {supplier_name}: {e}")
        return []

def main():
    """Simple main function"""
    print("🚀 Supplier Data Generator")
    print("=" * 40)
    
    # Check API key
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ No OpenAI API key found in .env.local")
        print("   Add: OPENAI_API_KEY=your_key_here")
        return
    
    project_root = Path(__file__).parent.parent
    data_dir = project_root / 'data'
    
    # Process pricelists
    suppliers_data = {}
    
    # Mahitaji
    mahitaji_pdf = data_dir / "mahitaji pricelist.pdf"
    if mahitaji_pdf.exists():
        print("📄 Processing Mahitaji pricelist...")
        text = extract_pdf_text(mahitaji_pdf)
        if text:
            products = generate_products("Mahitaji", text)
            suppliers_data['mahitaji'] = products
            print(f"✓ Extracted {len(products)} Mahitaji products")
    
    # Sam West
    samwest_pdf = data_dir / "SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2).pdf"
    if samwest_pdf.exists():
        print("📄 Processing Sam West pricelist...")
        text = extract_pdf_text(samwest_pdf)
        if text:
            products = generate_products("Sam West", text)
            suppliers_data['samwest'] = products
            print(f"✓ Extracted {len(products)} Sam West products")
    
    # Save results
    if suppliers_data:
        output_dir = data_dir / 'generated'
        output_dir.mkdir(exist_ok=True)
        
        # Save JSON
        output_file = output_dir / 'suppliers_products.json'
        with open(output_file, 'w') as f:
            json.dump(suppliers_data, f, indent=2)
        
        print(f"💾 Saved results to {output_file}")
        
        total = sum(len(products) for products in suppliers_data.values())
        print(f"🎉 Generated {total} total products!")
    else:
        print("❌ No data generated")

if __name__ == "__main__":
    main()