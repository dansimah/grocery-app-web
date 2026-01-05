const Product = require('../models/Product');
const Category = require('../models/Category');

class ProductService {
    // Parse a line to extract quantity and product term
    parseLineForProduct(line) {
        const trimmed = line.trim();
        
        // Pattern 1: Quantity first (e.g., "2 pommes", "3 apples")
        const qtyFirstMatch = trimmed.match(/^(\d+)\s+(.+)$/u);
        if (qtyFirstMatch) {
            const qty = parseInt(qtyFirstMatch[1]);
            const product = qtyFirstMatch[2].trim();
            if (!isNaN(qty) && product.length > 0) {
                return { quantity: qty, term: product };
            }
        }

        // Pattern 2: Quantity last (e.g., "pommes 2", "tomate 2")
        const qtyLastMatch = trimmed.match(/^(.+)\s+(\d+)$/u);
        if (qtyLastMatch) {
            const product = qtyLastMatch[1].trim();
            const qty = parseInt(qtyLastMatch[2]);
            if (!isNaN(qty) && product.length > 0) {
                return { quantity: qty, term: product };
            }
        }
        
        // No quantity found
        return { quantity: 1, term: trimmed };
    }

    // Lookup a product by name or alias
    async lookupProduct(term) {
        return Product.lookup(term);
    }

    // Parse multiple lines and return found/unfound items
    async parseLines(lines) {
        const found = [];
        const notFound = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            
            const { quantity, term } = this.parseLineForProduct(line);
            const product = await this.lookupProduct(term);
            
            if (product) {
                found.push({
                    product,
                    quantity,
                    originalInput: line.trim()
                });
                console.log(`✅ Found: "${term}" → ${product.name} [${product.category_name}]`);
            } else {
                notFound.push({
                    term,
                    quantity,
                    originalInput: line.trim()
                });
                console.log(`❌ Not found: "${term}"`);
            }
        }

        console.log(`📊 Lookup stats: ${found.length} found, ${notFound.length} need AI`);
        return { found, notFound };
    }

    // Create a new product and optionally add the original term as alias
    async createProduct(name, categoryId, originalTerm = null) {
        const product = await Product.create(name, categoryId);
        
        // If original term differs from product name, add as alias
        if (originalTerm && originalTerm.toLowerCase() !== name.toLowerCase()) {
            await product.addAlias(originalTerm);
        }
        
        return product;
    }

    // Get or create a category by name
    async getOrCreateCategory(categoryName) {
        let category = await Category.findByName(categoryName);
        if (!category) {
            category = await Category.create(categoryName, '📦', 50);
        }
        return category;
    }

    // Learn from AI result: create product and alias
    async learnFromAI(correctName, categoryName, originalInput) {
        // Get or create category
        const category = await this.getOrCreateCategory(categoryName);
        
        // Check if product already exists
        let product = await Product.findByName(correctName);
        
        if (product) {
            // Update category if different
            if (product.category_id !== category.id) {
                product.category_id = category.id;
                await product.save();
            }
        } else {
            // Create new product
            product = await Product.create(correctName, category.id);
            console.log(`➕ Created product: ${correctName} [${categoryName}]`);
        }
        
        // Add original input as alias if different
        if (originalInput && originalInput.toLowerCase() !== correctName.toLowerCase()) {
            await product.addAlias(originalInput);
            console.log(`📝 Added alias: "${originalInput}" → "${correctName}"`);
        }
        
        return product;
    }

    // Update a product's category (affects all items using this product)
    async updateProductCategory(productId, newCategoryId) {
        const product = await Product.findById(productId);
        if (!product) return null;
        
        product.category_id = newCategoryId;
        return product.save();
    }

    // Get all products grouped by category
    async getProductsByCategory() {
        const products = await Product.findAll();
        const grouped = {};
        
        for (const product of products) {
            const category = product.category_name || 'Autre';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(product);
        }
        
        return grouped;
    }
}

// Create singleton instance
const productService = new ProductService();

module.exports = productService;

