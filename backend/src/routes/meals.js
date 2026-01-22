const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Meal = require('../models/Meal');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all meals for the user
router.get('/', async (req, res) => {
    try {
        const meals = await Meal.findAllByUser(req.user.id);
        res.json(meals);
    } catch (error) {
        console.error('Error fetching meals:', error);
        res.status(500).json({ error: 'Failed to fetch meals' });
    }
});

// Get single meal with products
router.get('/:id', [
    param('id').isInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const meal = await Meal.findById(req.params.id, req.user.id);
        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }

        res.json(meal);
    } catch (error) {
        console.error('Error fetching meal:', error);
        res.status(500).json({ error: 'Failed to fetch meal' });
    }
});

// Create meal
router.post('/', [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('product_ids').optional().isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, product_ids = [] } = req.body;
        const meal = await Meal.create(req.user.id, name, product_ids);
        res.status(201).json(meal);
    } catch (error) {
        console.error('Error creating meal:', error);
        res.status(500).json({ error: 'Failed to create meal' });
    }
});

// Update meal
router.put('/:id', [
    param('id').isInt(),
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('product_ids').optional().isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, product_ids = [] } = req.body;
        const meal = await Meal.update(req.params.id, req.user.id, name, product_ids);
        res.json(meal);
    } catch (error) {
        if (error.message === 'Meal not found') {
            return res.status(404).json({ error: 'Meal not found' });
        }
        console.error('Error updating meal:', error);
        res.status(500).json({ error: 'Failed to update meal' });
    }
});

// Delete meal
router.delete('/:id', [
    param('id').isInt()
], async (req, res) => {
    try {
        const deleted = await Meal.delete(req.params.id, req.user.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        res.json({ message: 'Meal deleted' });
    } catch (error) {
        console.error('Error deleting meal:', error);
        res.status(500).json({ error: 'Failed to delete meal' });
    }
});

module.exports = router;
