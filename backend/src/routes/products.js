const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Category = require('../models/Category');
const authMiddleware = require('../middleware/auth');
const aiService = require('../services/aiService');
const spellService = require('../services/spellService');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Spell check suggestions for product name
router.get('/spell-suggest', [
    query('text').trim().isLength({ min: 1, max: 200 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        if (!spellService.isInitialized()) {
            return res.json({ 
                available: false, 
                message: 'Spell service not ready',
                words: [],
                combinedSuggestions: []
            });
        }

        const result = spellService.checkProductName(req.query.text);
        res.json({
            available: true,
            ...result
        });
    } catch (error) {
        console.error('Error checking spelling:', error);
        res.status(500).json({ error: 'Failed to check spelling' });
    }
});

// Get all categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create category
router.post('/categories', [
    body('name').trim().isLength({ min: 1 }),
    body('icon').optional().isLength({ max: 10 }),
    body('sort_order').optional().isInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, icon, sort_order } = req.body;
        const category = await Category.create(name, icon || '📦', sort_order || 50);
        aiService.clearCategoryCache(); // Clear AI cache on category change
        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category
router.put('/categories/:id', [
    param('id').isInt(),
    body('name').optional().trim().isLength({ min: 1 }),
    body('icon').optional().isLength({ max: 10 }),
    body('sort_order').optional().isInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (req.body.name) category.name = req.body.name;
        if (req.body.icon) category.icon = req.body.icon;
        if (req.body.sort_order !== undefined) category.sort_order = req.body.sort_order;

        const updated = await category.save();
        aiService.clearCategoryCache(); // Clear AI cache on category change
        res.json(updated);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category
router.delete('/categories/:id', [
    param('id').isInt()
], async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const productCount = await category.getProductCount();
        if (productCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with products',
                productCount 
            });
        }

        await category.delete();
        aiService.clearCategoryCache(); // Clear AI cache on category change
        res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Get all products
router.get('/', [
    query('category_id').optional().isInt(),
    query('search').optional().trim()
], async (req, res) => {
    try {
        let products;
        
        if (req.query.search) {
            products = await Product.search(req.query.search);
        } else if (req.query.category_id) {
            products = await Product.findByCategory(req.query.category_id);
        } else {
            products = await Product.findAll();
        }
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product with aliases
router.get('/:id', [
    param('id').isInt()
], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const aliases = await product.getAliases();
        res.json({ ...product, aliases });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Create product
router.post('/', [
    body('name').trim().isLength({ min: 1 }),
    body('category_id').isInt(),
    body('aliases').optional().isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, category_id, aliases } = req.body;
        
        // Check if product exists
        const existing = await Product.findByName(name);
        if (existing) {
            return res.status(400).json({ error: 'Product already exists' });
        }

        const product = await Product.create(name, category_id);
        
        // Add aliases
        if (aliases && aliases.length > 0) {
            for (const alias of aliases) {
                await product.addAlias(alias);
            }
        }

        const resultAliases = await product.getAliases();
        res.status(201).json({ ...product, aliases: resultAliases });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/:id', [
    param('id').isInt(),
    body('name').optional().trim().isLength({ min: 1 }),
    body('category_id').optional().isInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (req.body.name) product.name = req.body.name;
        if (req.body.category_id) product.category_id = req.body.category_id;

        const updated = await product.save();
        const fullProduct = await Product.findById(updated.id);
        const aliases = await fullProduct.getAliases();
        
        res.json({ ...fullProduct, aliases });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
router.delete('/:id', [
    param('id').isInt()
], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await product.delete();
        res.json({ message: 'Product deleted' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Fix product spelling using AI
router.post('/:id/fix-spelling', [
    param('id').isInt()
], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const originalName = product.name;
        const correctedName = await aiService.correctSpelling(originalName);
        
        // Check if the name actually changed
        const nameChanged = correctedName.toLowerCase().trim() !== originalName.toLowerCase().trim();
        
        if (nameChanged) {
            // Add original name as alias before updating
            await product.addAlias(originalName);
            
            // Update product name
            product.name = correctedName;
            await product.save();
        }

        const aliases = await product.getAliases();
        const fullProduct = await Product.findById(product.id);
        
        res.json({ 
            ...fullProduct, 
            aliases,
            corrected: nameChanged,
            originalName: nameChanged ? originalName : null
        });
    } catch (error) {
        console.error('Error fixing product spelling:', error);
        res.status(500).json({ error: error.message || 'Failed to fix spelling' });
    }
});

// Add alias to product
router.post('/:id/aliases', [
    param('id').isInt(),
    body('alias').trim().isLength({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await product.addAlias(req.body.alias);
        const aliases = await product.getAliases();
        res.json({ aliases });
    } catch (error) {
        console.error('Error adding alias:', error);
        res.status(500).json({ error: 'Failed to add alias' });
    }
});

// Remove alias from product
router.delete('/:id/aliases/:alias', [
    param('id').isInt()
], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await product.removeAlias(req.params.alias);
        const aliases = await product.getAliases();
        res.json({ aliases });
    } catch (error) {
        console.error('Error removing alias:', error);
        res.status(500).json({ error: 'Failed to remove alias' });
    }
});

module.exports = router;

