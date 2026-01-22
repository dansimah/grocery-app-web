const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const MenuPlan = require('../models/MenuPlan');
const authMiddleware = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get week plan
router.get('/', [
    query('week_start').optional().isISO8601()
], async (req, res) => {
    try {
        const weekStart = req.query.week_start || MenuPlan.getWeekStart();
        const plan = await MenuPlan.getWeekPlan(req.user.id, weekStart);
        res.json({ weekStart, plan });
    } catch (error) {
        console.error('Error fetching menu plan:', error);
        res.status(500).json({ error: 'Failed to fetch menu plan' });
    }
});

// Get all products needed for the week
router.get('/products', [
    query('week_start').optional().isISO8601()
], async (req, res) => {
    try {
        const weekStart = req.query.week_start || MenuPlan.getWeekStart();
        const products = await MenuPlan.getWeekProducts(req.user.id, weekStart);
        res.json(products);
    } catch (error) {
        console.error('Error fetching week products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get products for a specific meal
router.get('/meal/:mealId/products', [
    param('mealId').isInt()
], async (req, res) => {
    try {
        const products = await MenuPlan.getMealProducts(req.params.mealId);
        res.json(products);
    } catch (error) {
        console.error('Error fetching meal products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Add meal to a day
router.post('/day', [
    body('week_start').isISO8601(),
    body('day_of_week').isInt({ min: 0, max: 6 }),
    body('meal_type').isIn(['lunch', 'dinner']),
    body('meal_id').isInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { week_start, day_of_week, meal_type, meal_id } = req.body;
        const item = await MenuPlan.addMealToDay(req.user.id, week_start, day_of_week, meal_type, meal_id);
        
        // Return updated plan for the day
        const plan = await MenuPlan.getWeekPlan(req.user.id, week_start);
        res.json({ weekStart: week_start, plan });
    } catch (error) {
        console.error('Error adding meal to day:', error);
        res.status(500).json({ error: 'Failed to add meal' });
    }
});

// Remove meal from a day
router.delete('/item/:id', [
    param('id').isInt()
], async (req, res) => {
    try {
        const deleted = await MenuPlan.removeMealFromDay(req.user.id, req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({ message: 'Meal removed from plan' });
    } catch (error) {
        console.error('Error removing meal:', error);
        res.status(500).json({ error: 'Failed to remove meal' });
    }
});

// Clear all meals for a day
router.delete('/day', [
    body('week_start').isISO8601(),
    body('day_of_week').isInt({ min: 0, max: 6 })
], async (req, res) => {
    try {
        const { week_start, day_of_week } = req.body;
        await MenuPlan.clearDay(req.user.id, week_start, day_of_week);
        res.json({ message: 'Day cleared' });
    } catch (error) {
        console.error('Error clearing day:', error);
        res.status(500).json({ error: 'Failed to clear day' });
    }
});

// Add products to grocery list
router.post('/add-to-groceries', [
    body('product_ids').isArray({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { product_ids } = req.body;
        const batchId = `menu-${Date.now()}`;
        let addedCount = 0;

        for (const productId of product_ids) {
            // Check if already in grocery list
            const existing = await db.query(
                'SELECT id FROM grocery_items WHERE user_id = $1 AND product_id = $2 AND status != $3',
                [req.user.id, productId, 'found']
            );

            if (existing.rows.length === 0) {
                await db.query(
                    'INSERT INTO grocery_items (user_id, product_id, batch_id) VALUES ($1, $2, $3)',
                    [req.user.id, productId, batchId]
                );
                addedCount++;
            }
        }

        res.json({ 
            message: `Added ${addedCount} products to grocery list`,
            addedCount,
            skippedCount: product_ids.length - addedCount,
            batchId
        });
    } catch (error) {
        console.error('Error adding to groceries:', error);
        res.status(500).json({ error: 'Failed to add products' });
    }
});

// Copy week plan
router.post('/copy', [
    body('from_week_start').isISO8601(),
    body('to_week_start').isISO8601()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { from_week_start, to_week_start } = req.body;
        const copiedCount = await MenuPlan.copyWeek(req.user.id, from_week_start, to_week_start);
        res.json({ message: `Copied ${copiedCount} items`, copiedCount });
    } catch (error) {
        console.error('Error copying week:', error);
        res.status(500).json({ error: 'Failed to copy week' });
    }
});

module.exports = router;
