require('dotenv').config();
const { pool } = require('./database');

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories table (source of truth for categories)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(10) DEFAULT '📦',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Products table (known products with their category)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name)
);

-- Product aliases (spelling variants, alternative names)
CREATE TABLE IF NOT EXISTS product_aliases (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(alias)
);

-- Grocery items (user's active shopping list)
CREATE TABLE IF NOT EXISTS grocery_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    batch_id VARCHAR(50),
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Grocery history (completed shopping items)
CREATE TABLE IF NOT EXISTS grocery_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    category_name VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    status VARCHAR(50),
    completed_at TIMESTAMP DEFAULT NOW(),
    shopping_session_id VARCHAR(50)
);

-- AI request logs (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS ai_logs (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL,
    input_text TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    error_type VARCHAR(100),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_aliases_product ON product_aliases(product_id);
CREATE INDEX IF NOT EXISTS idx_aliases_alias ON product_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_grocery_items_user ON grocery_items(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_items_product ON grocery_items(product_id);
CREATE INDEX IF NOT EXISTS idx_grocery_items_status ON grocery_items(status);
CREATE INDEX IF NOT EXISTS idx_grocery_history_user ON grocery_history(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_history_session ON grocery_history(shopping_session_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_success ON ai_logs(success);
`;

async function runMigrations() {
    try {
        console.log('🔄 Creating database schema...');
        await pool.query(schema);
        console.log('✅ Database schema created successfully');
    } catch (error) {
        console.error('❌ Schema creation error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
