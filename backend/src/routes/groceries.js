const express = require('express');
const { body, param, validationResult } = require('express-validator');
const GroceryItem = require('../models/GroceryItem');
const Product = require('../models/Product');
const groceryService = require('../services/groceryService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all items (grouped by category)
router.get('/', async (req, res) => {
    try {
        const result = await groceryService.getAllItemsSorted(req.userId);
        res.json(result);
    } catch (error) {
        console.error('Error fetching groceries:', error);
        res.status(500).json({ error: 'Failed to fetch groceries' });
    }
});

// Parse and add items using AI
router.post('/parse', [
    body('text').trim().isLength({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { text } = req.body;
        const result = await groceryService.parseAndAddItems(req.userId, text);
        res.json(result);
    } catch (error) {
        console.error('Error parsing groceries:', error);
        res.status(500).json({ error: 'Failed to parse groceries' });
    }
});

// Add single item by product_id
router.post('/', [
    body('product_id').isInt(),
    body('quantity').optional().isInt({ min: 1 }),
    body('note').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { product_id, quantity = 1, note } = req.body;
        const item = await groceryService.addItemByProduct(req.userId, product_id, quantity, note);
        res.status(201).json(item);
    } catch (error) {
        console.error('Error adding grocery:', error);
        res.status(500).json({ error: error.message || 'Failed to add grocery' });
    }
});

// Update item
router.put('/:id', [
    param('id').isInt(),
    body('product_id').optional().isInt(),
    body('quantity').optional().isInt({ min: 1 }),
    body('note').optional().trim(),
    body('status').optional().isIn(['pending', 'selected', 'found', 'not_found'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const item = await GroceryItem.findById(req.params.id, req.userId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Update fields
        if (req.body.product_id) item.product_id = req.body.product_id;
        if (req.body.quantity) item.quantity = req.body.quantity;
        if (req.body.note !== undefined) item.note = req.body.note;
        if (req.body.status) item.status = req.body.status;

        await item.save();
        const updatedItem = await GroceryItem.findById(item.id, req.userId);
        res.json(updatedItem);
    } catch (error) {
        console.error('Error updating grocery:', error);
        res.status(500).json({ error: 'Failed to update grocery' });
    }
});

// Update item status (shopping mode)
router.patch('/:id/status', [
    param('id').isInt(),
    body('status').isIn(['pending', 'selected', 'found', 'not_found'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const item = await GroceryItem.updateStatus(
            req.params.id, 
            req.userId, 
            req.body.status
        );
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(item);
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Delete item
router.delete('/:id', [
    param('id').isInt()
], async (req, res) => {
    try {
        const item = await GroceryItem.findById(req.params.id, req.userId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        await item.delete();
        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting grocery:', error);
        res.status(500).json({ error: 'Failed to delete grocery' });
    }
});

// Cancel batch
router.delete('/batch/:batchId', async (req, res) => {
    try {
        const count = await GroceryItem.deleteBatch(req.userId, req.params.batchId);
        res.json({ message: `Deleted ${count} items` });
    } catch (error) {
        console.error('Error deleting batch:', error);
        res.status(500).json({ error: 'Failed to delete batch' });
    }
});

// Complete shopping (move found items to history)
router.post('/complete-shopping', async (req, res) => {
    try {
        const result = await groceryService.completeShoppingSession(req.userId);
        res.json(result);
    } catch (error) {
        console.error('Error completing shopping:', error);
        res.status(500).json({ error: 'Failed to complete shopping' });
    }
});

// Clear found items
router.delete('/status/found', async (req, res) => {
    try {
        const count = await GroceryItem.deleteByStatus(req.userId, 'found');
        res.json({ message: `Cleared ${count} found items` });
    } catch (error) {
        console.error('Error clearing found items:', error);
        res.status(500).json({ error: 'Failed to clear found items' });
    }
});

// Reset all selected to pending
router.post('/reset-selection', async (req, res) => {
    try {
        const items = await GroceryItem.findByStatus(req.userId, 'selected');
        let count = 0;
        for (const item of items) {
            await GroceryItem.updateStatus(item.id, req.userId, 'pending');
            count++;
        }
        res.json({ message: `Reset ${count} items to pending` });
    } catch (error) {
        console.error('Error resetting selection:', error);
        res.status(500).json({ error: 'Failed to reset selection' });
    }
});

// Get AI service stats (for admin view)
const aiService = require('../services/aiService');

router.get('/ai-stats', async (req, res) => {
    try {
        const stats = aiService.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting AI stats:', error);
        res.status(500).json({ error: 'Failed to get AI stats' });
    }
});

module.exports = router;

