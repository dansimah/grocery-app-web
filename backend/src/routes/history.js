const express = require('express');
const { param, query, validationResult } = require('express-validator');
const GroceryHistory = require('../models/GroceryHistory');
const GroceryItem = require('../models/GroceryItem');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get history
router.get('/', [
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('status').optional().isIn(['found', 'not_found'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const limit = parseInt(req.query.limit) || 100;
        let history;

        if (req.query.status) {
            history = await GroceryHistory.findByStatus(req.userId, req.query.status, limit);
        } else {
            history = await GroceryHistory.findAllByUser(req.userId, limit);
        }

        res.json(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get shopping sessions
router.get('/sessions', [
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const sessions = await GroceryHistory.getSessions(req.userId, limit);
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Get items from a specific session
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const items = await GroceryHistory.findBySession(req.userId, req.params.sessionId);
        res.json(items);
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// Restore item from history to active list
router.post('/:id/restore', [
    param('id').isInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Find history item
        const historyItem = await GroceryHistory.findById(req.params.id, req.userId);
        
        if (!historyItem) {
            return res.status(404).json({ error: 'History item not found' });
        }

        // Check if product still exists
        let productId = historyItem.product_id;
        
        if (!productId) {
            // Try to find product by name
            const product = await Product.findByName(historyItem.product_name);
            if (product) {
                productId = product.id;
            } else {
                return res.status(400).json({ 
                    error: 'Product no longer exists in catalog',
                    product_name: historyItem.product_name 
                });
            }
        }

        // Check if already in active list
        const existing = await GroceryItem.findByProduct(req.userId, productId);
        if (existing) {
            // Update quantity
            existing.quantity += historyItem.quantity;
            await existing.save();
            const updated = await GroceryItem.findById(existing.id, req.userId);
            return res.json(updated);
        }

        // Create new grocery item
        const newItem = new GroceryItem({
            user_id: req.userId,
            product_id: productId,
            quantity: historyItem.quantity,
            status: 'pending'
        });

        const savedItem = await newItem.save();
        const fullItem = await GroceryItem.findById(savedItem.id, req.userId);
        res.json(fullItem);
    } catch (error) {
        console.error('Error restoring item:', error);
        res.status(500).json({ error: 'Failed to restore item' });
    }
});

// Clear all history
router.delete('/', async (req, res) => {
    try {
        const count = await GroceryHistory.clearAll(req.userId);
        res.json({ message: `Cleared ${count} history items` });
    } catch (error) {
        console.error('Error clearing history:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

module.exports = router;
