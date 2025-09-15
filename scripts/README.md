# Supplier Product Data Generator

This script automatically extracts product information from supplier pricelists (PDF files) using OpenAI's API and updates the supplier module with structured product data.

## Features

- 📄 **PDF Text Extraction**: Extracts text from Mahitaji and Sam West pricelist PDFs
- 🤖 **AI-Powered Structuring**: Uses OpenAI GPT-4 to convert unstructured text into JSON product data
- 🔄 **Automatic Module Updates**: Updates the supplier module TypeScript file with new product information
- 💾 **JSON Output**: Saves structured data as JSON files for backup and review
- 🛡️ **Safe Updates**: Creates backups before modifying files

## Prerequisites

1. **Python 3.8+**: Download from [python.org](https://www.python.org/downloads/)
2. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
3. **PDF Files**: Ensure the following files exist in the `data/` folder:
   - `mahitaji pricelist.pdf`
   - `SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2).pdf`

## Setup

### Option 1: Using Batch Script (Windows)
```batch
# Run the batch script which handles everything
generate-products.bat
```

### Option 2: Using PowerShell (Windows)
```powershell
# Allow script execution if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run the PowerShell script
.\generate-products.ps1
```

### Option 3: Manual Python Setup
```bash
# Install dependencies
pip install -r scripts/requirements.txt

# Set your OpenAI API key
set OPENAI_API_KEY=your_openai_api_key_here

# Run the script
python scripts/generate-supplier-products.py
```

## Usage Options

### Basic Usage
```bash
python scripts/generate-supplier-products.py
```

### With API Key Argument
```bash
python scripts/generate-supplier-products.py --api-key your_openai_api_key_here
```

### Generate JSON Only (Don't Update Module)
```bash
python scripts/generate-supplier-products.py --output-only
```

## Output Files

The script generates several files in the `data/generated/` folder:

- `mahitaji_products.json` - Mahitaji products data
- `samwest_products.json` - Sam West products data  
- `all_suppliers_products.json` - Combined data from both suppliers

## What the Script Does

1. **Extract PDF Text**: Reads and extracts text from both supplier PDF pricelists
2. **Clean Text**: Normalizes and cleans the extracted text for better processing
3. **AI Processing**: Sends cleaned text to OpenAI GPT-4 with structured prompts to extract:
   - Product names
   - SKU codes
   - Categories
   - Prices (in KSh)
   - Stock status
   - Minimum order quantities
   - Lead times
4. **Generate JSON**: Creates structured JSON files with all extracted product data
5. **Update Module**: Automatically updates the `supplier-module.tsx` file with new product arrays
6. **Create Backup**: Saves a backup of the original module file before making changes

## Product Data Structure

Each product object contains:
```json
{
  "id": "mah_001",
  "name": "Premium Maize Flour 2kg",
  "sku": "MAH-FLR-001", 
  "category": "Flour & Grains",
  "unitPrice": 185.00,
  "inStock": true,
  "minOrderQuantity": 10,
  "leadTime": "1-2 days"
}
```

## Supplier Data Integration

The script automatically integrates the products into supplier objects with:
- Contact information
- Payment terms
- Credit limits and utilization
- Account balances
- Complete product catalogs

## Error Handling

- **PDF Reading Errors**: Continues processing if one PDF fails
- **API Errors**: Provides clear error messages for API issues
- **JSON Parsing**: Validates and handles malformed JSON responses
- **File Operations**: Creates necessary directories and handles file permissions

## Troubleshooting

### Common Issues

1. **"Python not found"**
   - Install Python from python.org
   - Make sure Python is added to your PATH

2. **"OpenAI API key required"**
   - Set environment variable: `set OPENAI_API_KEY=your_key`
   - Or pass as argument: `--api-key your_key`

3. **"Permission denied writing files"**
   - Run as administrator
   - Check file permissions in the project directory

4. **"PyPDF2 import error"**
   - Run: `pip install -r scripts/requirements.txt`
   - Make sure all dependencies are installed

### API Key Security

- Never commit API keys to version control
- Use environment variables for production
- Consider using `.env` files for development (not included in git)

## Customization

You can modify the script to:
- Add more suppliers by updating the `process_pricelists()` method
- Change the AI prompts in `generate_products_with_llm()` for different data extraction
- Modify the TypeScript output format in `generate_typescript_suppliers()`
- Add additional validation or data transformation steps

## Cost Considerations

- Uses OpenAI GPT-4 API (paid service)
- Typical cost: ~$0.10-0.30 per pricelist depending on size
- Processes up to 50 products per supplier to manage costs
- Consider using GPT-3.5-turbo for lower costs (change model in script)

## License

This script is part of the VendAI POS system and follows the same license terms.