const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateRegister = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().isLength({ min: 1 })
];

const validateLogin = [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
];

// Register - DISABLED (registrations are closed)
router.post('/register', validateRegister, async (req, res) => {
    return res.status(403).json({ error: 'Registrations are closed. Contact the administrator.' });
    // try {
    //     const errors = validationResult(req);
    //     if (!errors.isEmpty()) {
    //         return res.status(400).json({ errors: errors.array() });
    //     }

    //     const { email, password, name } = req.body;

    //     // Check if user exists
    //     const existingUser = await User.findByEmail(email);
    //     if (existingUser) {
    //         return res.status(400).json({ error: 'Email already registered' });
    //     }

    //     // Create user
    //     const user = await User.create(email, password, name);

    //     // Generate token
    //     const token = jwt.sign(
    //         { userId: user.id },
    //         process.env.JWT_SECRET,
    //         { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    //     );

    //     res.status(201).json({
    //         message: 'User created successfully',
    //         user: user.toJSON(),
    //         token
    //     });
    // } catch (error) {
    //     console.error('Register error:', error);
    //     res.status(500).json({ error: 'Registration failed' });
    // }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await user.verifyPassword(password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            message: 'Login successful',
            user: user.toJSON(),
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    res.json({ user: req.user.toJSON() });
});

module.exports = router;

