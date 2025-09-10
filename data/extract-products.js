const fs = require('fs');
const pdfParse = require('pdf-parse');

const PRODUCT_TEMPLATE = {
  id: null,
  name: '',
  description: '',
  price: 60, // Set to 10 more than 50 as requested
  wholesalePrice: 50,
  category: 'food',
  brand: '',
  inStock: true,
  unit: 'Bag',
  code: '',
  image: '',
  distributorName: 'Permarket'
};

const PRODUCT_IMAGE_TEMPLATE = {
  id: null,
  productId: null,
  filename: '',
  path: '',
  alt: '',
  isPrimary: true
};

let productIdCounter = 2000; // Start from 2000
let imageIdCounter = 2000; // Start from 2000

function generateCode(brand) {
  return `${brand.substring(0, 2).toUpperCase()}${String(productIdCounter).padStart(3, '0')}`;
}

function generateImageFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '.jpg';
}

function parseProductLine(line) {
  const match = line.match(/(\d+KG\s+(.+?))\s+(KES\s+\d+\.\d+)/);
  if (match) {
    const name = match[1].trim();
    const brand = name.split(' ')[1] || 'Generic'; // Extract brand or default
    const code = generateCode(brand);
    const imageFilename = generateImageFilename(name);
    const imagePath = `/images/products/${imageFilename}`;
    const alt = `${name.toUpperCase()} ${PRODUCT_TEMPLATE.unit}`;

    return {
      ...PRODUCT_TEMPLATE,
      id: productIdCounter++,
      name,
      description: `${PRODUCT_TEMPLATE.unit.toLowerCase()} of ${name.toLowerCase()}`,
      brand,
      code,
      image: imagePath,
      productImage: {
        ...PRODUCT_IMAGE_TEMPLATE,
        id: imageIdCounter++,
        productId: productIdCounter - 1,
        filename: imageFilename,
        path: imagePath,
        alt
      }
    };
  }
  return null;
}

function processPdfData(data) {
  const lines = data.text.split('\n').filter(line => line.trim());
  const products = [];
  const productImages = [];

  for (let line of lines) {
    const product = parseProductLine(line);
    if (product) {
      products.push(product);
      productImages.push(product.productImage);
      delete product.productImage; // Remove temporary image field
    }
  }

  // Write to product.ts
  const productTsContent = `import type { Product } from "@/lib/types";

export const PRODUCTS: Product[] = ${JSON.stringify(products, null, 2)};`;
  fs.writeFileSync('/data/product.ts', productTsContent);

  // Write to product-images.ts
  const productImagesTsContent = `export interface ProductImage {
  id: number;
  productId: number;
  filename: string;
  path: string;
  alt: string;
  isPrimary: boolean;
}

export const PRODUCT_IMAGES: ProductImage[] = ${JSON.stringify(productImages, null, 2)};`;
  fs.writeFileSync('/data/product-images.ts', productImagesTsContent);

  console.log('Files generated successfully!');
}

const pdfPath = 'products.pdf';
fs.readFile(pdfPath, (err, pdfBuffer) => {
  if (err) {
    console.error('Error reading PDF:', err);
    return;
  }
  pdfParse(pdfBuffer).then(processPdfData).catch(console.error);
});