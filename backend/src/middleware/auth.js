const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Simple in-memory cache for user lookups (5 min TTL)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedUser(userId) {
    const cached = userCache.get(userId);
    if (cached && Date.now() < cached.expiry) {
        return cached.user;
    }
    userCache.delete(userId);
    return null;
}

function setCachedUser(userId, user) {
    userCache.set(userId, {
        user,
        expiry: Date.now() + CACHE_TTL,
    });
}

// Clear cache for a specific user (call on logout, password change, etc.)
function clearUserCache(userId) {
    userCache.delete(userId);
}

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Try cache first
        let user = getCachedUser(decoded.userId);
        
        if (!user) {
            // Find user in database
            user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }
            // Cache the user
            setCachedUser(decoded.userId, user);
        }

        // Attach user to request
        req.user = user;
        req.userId = user.id;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

module.exports = authMiddleware;
module.exports.clearUserCache = clearUserCache;

