require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { validateEnv } = require('./config/env');
const db = require('./config/database');
const aiService = require('./services/aiService');
const spellService = require('./services/spellService');

// Validate environment before anything else
validateEnv();

// Import routes
const authRoutes = require('./routes/auth');
const groceriesRoutes = require('./routes/groceries');
const historyRoutes = require('./routes/history');
const productsRoutes = require('./routes/products');
const mealsRoutes = require('./routes/meals');
const menuRoutes = require('./routes/menu');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health', // Don't rate limit health checks
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit auth attempts
    message: { error: 'Too many login attempts, please try again later' },
});

app.use(limiter);

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10kb' })); // Limit body size

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Health check
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            database: 'connected',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy', 
            database: 'disconnected',
            timestamp: new Date().toISOString(),
        });
    }
});

// Routes with specific rate limits
// Only apply auth rate limiter to login/register, not to /me
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/groceries', groceriesRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/menu', menuRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(err.status || 500).json({ error: message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    await db.pool.end();
    process.exit(0);
});

// Start server
async function start() {
    try {
        // Test database connection
        await db.query('SELECT NOW()');
        console.log('✅ Database connection successful');

        // Initialize AI service
        aiService.initialize();

        // Initialize spell service (async, non-blocking)
        spellService.initialize().catch(err => 
            console.warn('⚠️ Spell service init failed:', err.message)
        );

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();

