const fs = require('fs');
const path = require('path');

// Path to the products.ts file
const productsFilePath = path.join(__dirname, 'products.ts');

try {
  // Read the file
  const fileContent = fs.readFileSync(productsFilePath, 'utf8');
  
  // Regular expression to match product objects
  // This matches from opening brace to closing brace, handling nested objects
  const productRegex = /(\s*{\s*\n(?:[^{}]*|\{[^{}]*\})*\n\s*})/g;
  
  // Function to add distributorName to a product object string
  function addDistributorName(productString) {
    // Check if distributorName already exists
    if (productString.includes('distributorName:')) {
      return productString;
    }
    
    // Find the description field and add comma if missing, then add distributorName after it
    const lines = productString.split('\n');
    const descriptionLineIndex = lines.findIndex(line => line.includes('description:'));
    
    if (descriptionLineIndex >= 0) {
      // Add comma to description line if it doesn't have one
      if (!lines[descriptionLineIndex].trim().endsWith(',')) {
        lines[descriptionLineIndex] = lines[descriptionLineIndex] + ',';
      }
      
      // Get indentation from the description line
      const indentation = lines[descriptionLineIndex].match(/^\s*/)[0];
      
      // Insert distributorName after the description line with comma at the end
      lines.splice(descriptionLineIndex + 1, 0, `${indentation}distributorName: "Mahitaji Enterprises",`);
    } else {
      // Fallback: add at the end if no description field found
      const closingBraceIndex = lines.findIndex(line => line.trim() === '}');
      if (closingBraceIndex > 0) {
        const indentation = lines[closingBraceIndex - 1].match(/^\s*/)[0];
        lines.splice(closingBraceIndex, 0, `${indentation}distributorName: "Mahitaji Enterprises",`);
      }
    }
    
    return lines.join('\n');
  }
  
  // Replace all product objects with updated ones
  const updatedContent = fileContent.replace(productRegex, (match) => {
    return addDistributorName(match);
  });
  
  // Write the updated content back to the file
  fs.writeFileSync(productsFilePath, updatedContent, 'utf8');
  
  console.log('Successfully added distributorName to all products in products.ts');
  console.log('Added field: distributorName: "Mahitaji Enterprises"');
  
} catch (error) {
  console.error('Error processing products.ts:', error.message);
  
  // Check if file exists
  if (error.code === 'ENOENT') {
    console.error('Make sure the products.ts file exists in the correct location.');
    console.error('Expected path:', productsFilePath);
  }
}