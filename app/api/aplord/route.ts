import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Replicate from 'replicate';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface ProductData {
  code: string;
  name: string;
  brand: string;
  variant?: string;
  size?: string;
  pack_size?: number;
  unit: string;
  distributor?: string;
  price_distributor: number;
  price_unit?: number;
  category: string;
  image_url?: string;
  tags: string[];
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate API keys first
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured', 
        step: 'initialization' 
      }, { status: 500 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Replicate API token not configured', 
        step: 'initialization' 
      }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided', 
        step: 'file_validation' 
      }, { status: 400 });
    }

    // Validate file type and size
    const allowedTypes = [
      'text/csv', 
      'application/pdf', 
      'text/plain', 
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload CSV, PDF, TXT, or Excel files only.', 
        step: 'file_validation',
        fileType: file.type 
      }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB.', 
        step: 'file_validation',
        fileSize: file.size 
      }, { status: 400 });
    }

    // AI Agent Phase 1: Document Analysis & Text Extraction
    console.log('🤖 AI Agent: Starting intelligent document analysis...');
    
    let fileContent: string;
    try {
      fileContent = await file.text();
      
      if (!fileContent || fileContent.trim().length === 0) {
        return NextResponse.json({ 
          error: 'File appears to be empty or unreadable', 
          step: 'text_extraction' 
        }, { status: 400 });
      }

      // Validate content has product-like data
      const hasProductIndicators = /(?:price|cost|sku|code|item|product|name|brand)/i.test(fileContent);
      if (!hasProductIndicators) {
        return NextResponse.json({ 
          error: 'File does not appear to contain product inventory data', 
          step: 'content_validation' 
        }, { status: 400 });
      }

    } catch (e) {
      console.error('File reading error:', e);
      return NextResponse.json({ 
        error: 'Failed to read file content. File may be corrupted.', 
        step: 'text_extraction' 
      }, { status: 400 });
    }

    // AI Agent Phase 2: Intelligent Data Extraction
    console.log('🧠 AI Agent: Performing intelligent data extraction...');
    
    const extractionPrompt = `
    You are an advanced AI agent specialized in processing inventory and price list documents. 
    Your task is to intelligently analyze and extract structured product data from various document formats.

    EXTRACTION REQUIREMENTS:
    1. Extract ALL products found in the document
    2. For each product, extract these fields (mark as null if not found):
       - code: Product code/SKU/Item number
       - name: Clean, descriptive product name (remove excess formatting)
       - brand: Brand/manufacturer name
       - variant: Product variant/flavor/type/model
       - size: Product size with unit (e.g., "500ml", "1kg", "250g")
       - pack_size: Items per pack/carton/case (number only)
       - unit: Unit type (CTN, PC, PKT, DOZ, BOX, EA, etc.)
       - distributor: Distributor/supplier name if mentioned
       - price_distributor: Wholesale/distributor price (number only)
       - price_unit: Unit price if different from distributor price
       - category: Classify into logical category (Food & Beverages, Personal Care, Household, etc.)
       - tags: Array of searchable keywords (brand, category, size, type)
       - description: Brief description if available

    PROCESSING RULES:
    - Clean up product names (remove excess spaces, fix capitalization)
    - Extract numeric values from prices (remove currency symbols)
    - Standardize units (ml, g, kg, L, etc.)
    - Categorize products logically
    - Generate relevant search tags
    - If data is ambiguous, make reasonable assumptions
    - Ensure all extracted products have at minimum: name, price, and category

    Document content:
    ${fileContent.slice(0, 8000)} ${fileContent.length > 8000 ? '...[truncated]' : ''}

    Return ONLY a valid JSON array of products. No markdown formatting, no explanations, no comments.
    Example format:
    [{"code":"ABC123","name":"Product Name","brand":"Brand","variant":"Flavor","size":"500ml","pack_size":12,"unit":"CTN","price_distributor":25.99,"category":"Food & Beverages","tags":["brand","food","beverage"],"description":"Product description"}]
    `;

    let extraction;
    try {
      extraction = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 4000,
      });
    } catch (e) {
      console.error('OpenAI API error:', e);
      return NextResponse.json({ 
        error: 'Failed to process document with AI. Please try again.', 
        step: 'ai_extraction',
        details: e instanceof Error ? e.message : 'OpenAI API error'
      }, { status: 500 });
    }

    let products: ProductData[] = [];
    try {
      const extractedContent = extraction.choices[0]?.message?.content;
      if (!extractedContent) {
        throw new Error('No content received from AI');
      }

      // Clean up the response in case it has markdown formatting
      const cleanContent = extractedContent.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
      products = JSON.parse(cleanContent);
      
      if (!Array.isArray(products)) {
        throw new Error('AI response is not an array');
      }

      if (products.length === 0) {
        return NextResponse.json({ 
          error: 'No products could be extracted from the document', 
          step: 'data_validation' 
        }, { status: 400 });
      }

      // Validate and clean extracted products
      products = products.filter(product => 
        product && 
        typeof product === 'object' && 
        product.name && 
        product.name.trim().length > 0 &&
        product.price_distributor !== null &&
        product.price_distributor !== undefined &&
        !isNaN(Number(product.price_distributor))
      ).map(product => ({
  ...product,
  name: product.name.trim(),
  brand: product.brand?.trim() || "",
  category: product.category?.trim() || 'Uncategorized',
  tags: Array.isArray(product.tags) ? product.tags : [],
  price_distributor: Number(product.price_distributor)
      }));

    } catch (e) {
      console.error('JSON parsing error:', e);
      return NextResponse.json({ 
        error: 'AI extracted invalid data format. Please try with a different document.', 
        step: 'data_parsing',
        details: e instanceof Error ? e.message : 'JSON parsing failed'
      }, { status: 500 });
    }

    console.log(`🎯 AI Agent: Successfully extracted ${products.length} valid products`);

    // AI Agent Phase 3: Intelligent Image Generation
    const productsWithImages = [...products];
    const maxImages = Math.min(5, products.length); // Generate up to 5 images
    
    for (let i = 0; i < maxImages; i++) {
      const product = products[i];
      console.log(`🎨 AI Agent: Generating product image ${i + 1}/${maxImages} for ${product.name}...`);

      try {
        // Create intelligent image generation prompt
        const imagePrompt = `Professional product photography of ${product.name} ${product.brand || ''} ${product.variant || ''} ${product.size || ''}. 
        High-quality commercial product shot on a clean dark slate background with subtle texture, similar to modern POS system interfaces. 
        Ultra-sharp focus, perfect lighting, premium presentation style with soft shadows for depth. 
        Product centered in frame, clean composition, slightly desaturated colors with digital enhancement. 
        Commercial photography style, studio lighting, professional quality.`;

        const imageGeneration = await replicate.run(
          "black-forest-labs/flux-1.1-pro" as any,
          {
            input: {
              prompt: imagePrompt,
              aspect_ratio: "1:1",
              output_format: "webp",
              output_quality: 85,
              safety_tolerance: 2,
              num_outputs: 1,
            }
          }
        );

        if (imageGeneration && Array.isArray(imageGeneration) && imageGeneration[0]) {
          productsWithImages[i] = {
            ...product,
            image_url: imageGeneration[0] as string
          };
          console.log(`✅ AI Agent: Generated image for ${product.name}`);
        }
      } catch (error) {
        console.error(`❌ AI Agent: Image generation failed for ${product.name}:`, error);
        // Continue without image - non-blocking error
      }
    }

    console.log('🎯 AI Agent: Processing completed successfully!');

    return NextResponse.json({
      success: true,
      message: `AI Agent successfully processed ${products.length} products with ${maxImages} product images generated`,
      products: productsWithImages,
      stats: {
        total_products: products.length,
        images_generated: maxImages,
        file_size: file.size,
        file_type: file.type,
        processing_agent: 'AI Inventory Agent v2.0'
      }
    });

  } catch (error) {
    console.error('AI Agent Critical Error:', error);
    return NextResponse.json({ 
      error: 'AI processing engine encountered an unexpected error', 
      step: 'critical_error',
      details: error instanceof Error ? error.message : 'Unknown system error'
    }, { status: 500 });
  }
}
