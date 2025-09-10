"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var products_1 = require("./products");
// Function to convert a product to CSV row
var productToCSV = function (product) {
    return "".concat(product.id, ",").concat(product.name, ",").concat(product.wholesalePrice, ",").concat(product.category, ",").concat(product.description, ",").concat(product.image, ",").concat(product.stock, ",").concat(product.unit, ",").concat(product.brand || '', ",").concat(product.size || '', ",").concat(product.price || '', ",").concat(product.wholesaleQuantity || '');
};
// Function to group products by category and save to CSV files
var generateCategoryCSVs = function () {
    // Object to store products grouped by category
    var categories = {};
    // Group products by category
    products_1.PRODUCTS.forEach(function (product) {
        if (!categories[product.category]) {
            categories[product.category] = [];
        }
        categories[product.category].push(product);
    });
    // Generate CSV file for each category
    Object.entries(categories).forEach(function (_a) {
        var category = _a[0], products = _a[1];
        // Convert category name to lowercase and replace spaces/special chars for filename
        var fileName = category.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.csv';
        // Create CSV content with header
        var header = 'id,name,wholesalePrice,category,description,image,stock,unit,brand,size,price,wholesaleQuantity\n';
        var csvContent = header + products.map(productToCSV).join('\n');
        // Write to file
        try {
            fs.writeFileSync(fileName, csvContent);
            console.log("Successfully created ".concat(fileName, " with ").concat(products.length, " products"));
        }
        catch (error) {
            console.error("Error writing ".concat(fileName, ":"), error);
        }
    });
};
// Execute the function
generateCategoryCSVs();
