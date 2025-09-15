#!/usr/bin/env python3
"""
Supplier Product Data Generator using OpenAI API
Extracts product data from Mahitaji and Sam West pricelists and updates the supplier module
"""

import os
import json
import re
import PyPDF2
from openai import OpenAI
from pathlib import Path
import argparse
from typing import Dict, List, Any

def load_env_file(env_path: str) -> None:
    """Load environment variables from .env.local file"""
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    # Remove quotes if present
                    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                        value = value[1:-1]
                    os.environ[key] = value
        print(f"✓ Loaded environment variables from {env_path}")
    else:
        print(f"⚠ Environment file not found: {env_path}")

class SupplierDataGenerator:
    def __init__(self, api_key: str = None):
        """Initialize with OpenAI API key"""
        # Load environment variables from .env.local
        env_local_path = Path(__file__).parent.parent / '.env.local'
        load_env_file(str(env_local_path))
        
        self.client = OpenAI(
            api_key=api_key or os.getenv('OPENAI_API_KEY')
        )
        self.project_root = Path(__file__).parent.parent
        self.data_dir = self.project_root / 'data'
        
    def extract_pdf_text(self, pdf_path: str) -> str:
        """Extract text from PDF file"""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            print(f"Error reading PDF {pdf_path}: {e}")
            return ""

    def clean_text(self, text: str) -> str:
        """Clean and normalize extracted text"""
        # Remove extra whitespace and normalize
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters that might interfere
        text = re.sub(r'[^\w\s\.\,\-\(\)\@\#\%\$\&\+\=\:\;]', '', text)
        return text.strip()

    def generate_products_with_llm(self, supplier_name: str, pricelist_text: str) -> List[Dict[str, Any]]:
        """Use OpenAI to structure product data from pricelist text"""
        
        system_prompt = """You are a data extraction expert specializing in converting supplier pricelists into structured product data for a POS system.

Your task is to analyze the provided pricelist text and extract product information into a standardized JSON format.

For each product, extract:
- id: unique identifier (use format: supplier_initials_001, supplier_initials_002, etc.)
- name: clean product name
- sku: product SKU/code if available, or generate one using format: SUP-CAT-001
- category: product category (e.g., "Beverages", "Snacks", "Personal Care", "Household", etc.)
- unitPrice: price as a number (extract from various price formats)
- inStock: always true (assume all listed products are available)
- minOrderQuantity: reasonable minimum order (default to 1 if not specified)
- leadTime: reasonable lead time (default to "1-2 days" if not specified)

Guidelines:
- Clean up product names (remove excess spacing, formatting artifacts)
- Standardize categories into common retail categories
- Extract prices carefully, handling different formats (KSh, Ksh, numbers only, etc.)
- Generate reasonable SKUs if not provided
- Be conservative with price extraction - if unclear, mark as 0.00
- Limit to maximum 50 most relevant/clear products to avoid overwhelming the system

Return ONLY a valid JSON array of product objects, no additional text or explanations."""

        user_prompt = f"""
Supplier: {supplier_name}
Extract product data from this pricelist:

{pricelist_text[:15000]}  # Limit text to stay within token limits

Return structured product data as JSON array.
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=4000,
                temperature=0.1
            )
            
            # Extract JSON from response
            content = response.choices[0].message.content.strip()
            
            # Try to find JSON in the response
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                products = json.loads(json_str)
                return products
            else:
                print(f"Could not extract JSON from response for {supplier_name}")
                return []
                
        except Exception as e:
            print(f"Error calling OpenAI API for {supplier_name}: {e}")
            return []

    def process_pricelists(self) -> Dict[str, List[Dict[str, Any]]]:
        """Process both supplier pricelists"""
        suppliers_data = {}
        
        # Process Mahitaji pricelist
        mahitaji_pdf = self.data_dir / "mahitaji pricelist.pdf"
        if mahitaji_pdf.exists():
            print("Processing Mahitaji pricelist...")
            text = self.extract_pdf_text(str(mahitaji_pdf))
            clean_text = self.clean_text(text)
            products = self.generate_products_with_llm("Mahitaji Enterprises Ltd", clean_text)
            suppliers_data["mahitaji"] = products
            print(f"Extracted {len(products)} products from Mahitaji pricelist")
        else:
            print("Mahitaji pricelist not found")
            
        # Process Sam West pricelist  
        samwest_pdf = self.data_dir / "SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2).pdf"
        if samwest_pdf.exists():
            print("Processing Sam West pricelist...")
            text = self.extract_pdf_text(str(samwest_pdf))
            clean_text = self.clean_text(text)
            products = self.generate_products_with_llm("Sam West Distributors", clean_text)
            suppliers_data["samwest"] = products
            print(f"Extracted {len(products)} products from Sam West pricelist")
        else:
            print("Sam West pricelist not found")
            
        return suppliers_data

    def save_products_json(self, suppliers_data: Dict[str, List[Dict[str, Any]]]) -> None:
        """Save extracted products to JSON files"""
        output_dir = self.project_root / "data" / "generated"
        output_dir.mkdir(exist_ok=True)
        
        # Save individual supplier files
        for supplier, products in suppliers_data.items():
            output_file = output_dir / f"{supplier}_products.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(products, f, indent=2, ensure_ascii=False)
            print(f"Saved {len(products)} products to {output_file}")
            
        # Save combined file
        combined_file = output_dir / "all_suppliers_products.json"
        with open(combined_file, 'w', encoding='utf-8') as f:
            json.dump(suppliers_data, f, indent=2, ensure_ascii=False)
        print(f"Saved combined data to {combined_file}")

    def update_supplier_module(self, suppliers_data: Dict[str, List[Dict[str, Any]]]) -> None:
        """Update the supplier module TypeScript file with new product data"""
        
        supplier_module_path = self.project_root / "components" / "modules" / "supplier-module.tsx"
        
        if not supplier_module_path.exists():
            print("Supplier module not found")
            return
            
        # Read current file
        with open(supplier_module_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Generate TypeScript supplier objects
        ts_suppliers = self.generate_typescript_suppliers(suppliers_data)
        
        # Find and replace the suppliers data
        # Look for the suppliers array definition
        pattern = r'const suppliers: Supplier\[\] = \[.*?\]'
        
        if re.search(pattern, content, re.DOTALL):
            new_content = re.sub(
                pattern, 
                f'const suppliers: Supplier[] = [\n{ts_suppliers}\n  ]',
                content, 
                flags=re.DOTALL
            )
            
            # Create backup
            backup_path = supplier_module_path.with_suffix('.tsx.backup')
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            # Write updated file
            with open(supplier_module_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
                
            print(f"Updated supplier module with new product data")
            print(f"Backup saved to {backup_path}")
        else:
            print("Could not find suppliers array in module file")

    def generate_typescript_suppliers(self, suppliers_data: Dict[str, List[Dict[str, Any]]]) -> str:
        """Generate TypeScript supplier objects"""
        
        suppliers_ts = []
        
        # Mahitaji supplier
        if "mahitaji" in suppliers_data:
            products_json = json.dumps(suppliers_data["mahitaji"], indent=6)
            mahitaji_supplier = f'''    {{
      id: "mahitaji_enterprises",
      name: "Mahitaji Enterprises Ltd",
      contact: {{
        email: "info@mahitaji.co.ke",
        phone: "+254 700 123 456",
        address: "Nairobi, Kenya"
      }},
      paymentTerms: "Net 30",
      creditLimit: 2000000,
      currentCredit: 850000,
      accountBalance: -150000,
      products: {products_json.replace('    ', '      ')}
    }}'''
            suppliers_ts.append(mahitaji_supplier)
            
        # Sam West supplier
        if "samwest" in suppliers_data:
            products_json = json.dumps(suppliers_data["samwest"], indent=6)
            samwest_supplier = f'''    {{
      id: "sam_west_distributors", 
      name: "Sam West Distributors",
      contact: {{
        email: "orders@samwest.co.ke",
        phone: "+254 722 345 678", 
        address: "Mombasa, Kenya"
      }},
      paymentTerms: "Net 15",
      creditLimit: 1500000,
      currentCredit: 650000,
      accountBalance: 25000,
      products: {products_json.replace('    ', '      ')}
    }}'''
            suppliers_ts.append(samwest_supplier)
            
        return ',\n'.join(suppliers_ts)

def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description='Generate supplier product data using OpenAI')
    parser.add_argument('--api-key', help='OpenAI API key (or use .env.local file)')
    parser.add_argument('--output-only', action='store_true', help='Only generate JSON, do not update module')
    
    args = parser.parse_args()
    
    # Initialize generator (it will auto-load from .env.local)
    generator = SupplierDataGenerator(args.api_key)
    
    # Check if we have an API key
    if not (args.api_key or os.getenv('OPENAI_API_KEY')):
        print("❌ Error: OpenAI API key required.")
        print("   Either:")
        print("   1. Add OPENAI_API_KEY to .env.local file")
        print("   2. Use --api-key argument")
        print("   3. Set OPENAI_API_KEY environment variable")
        return
    
    print("Starting supplier data generation...")
    print("=" * 50)
    
    # Process pricelists
    suppliers_data = generator.process_pricelists()
    
    if not suppliers_data:
        print("No data extracted from pricelists")
        return
        
    # Save JSON files
    generator.save_products_json(suppliers_data)
    
    # Update module unless output-only is specified
    if not args.output_only:
        print("\nUpdating supplier module...")
        generator.update_supplier_module(suppliers_data)
    
    print("\n" + "=" * 50)
    print("Generation complete!")
    
    # Print summary
    total_products = sum(len(products) for products in suppliers_data.values())
    print(f"Total products processed: {total_products}")
    for supplier, products in suppliers_data.items():
        print(f"  {supplier}: {len(products)} products")

if __name__ == "__main__":
    main()