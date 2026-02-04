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

-- Meals table (user-defined recipes)
CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Meal items (products in a meal)
CREATE TABLE IF NOT EXISTS meal_items (
    id SERIAL PRIMARY KEY,
    meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(meal_id, product_id)
);

-- Menu plans (weekly meal planning)
CREATE TABLE IF NOT EXISTS menu_plan_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    meal_type VARCHAR(20) NOT NULL DEFAULT 'dinner',
    meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, week_start, day_of_week, meal_type, meal_id)
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Migration: Add meal_type column and update constraint
DO $$ 
BEGIN
    -- Add meal_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'menu_plan_items' AND column_name = 'meal_type') THEN
        ALTER TABLE menu_plan_items ADD COLUMN meal_type VARCHAR(20) NOT NULL DEFAULT 'dinner';
    END IF;
    
    -- Drop old constraint if it exists (without meal_type)
    IF EXISTS (SELECT 1 FROM pg_constraint 
               WHERE conname = 'menu_plan_items_user_id_week_start_day_of_week_meal_id_key') THEN
        ALTER TABLE menu_plan_items DROP CONSTRAINT menu_plan_items_user_id_week_start_day_of_week_meal_id_key;
    END IF;
    
    -- Create new constraint with meal_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'menu_plan_items_user_id_week_start_day_of_week_meal_type_m_key') THEN
        ALTER TABLE menu_plan_items ADD CONSTRAINT menu_plan_items_user_id_week_start_day_of_week_meal_type_m_key 
            UNIQUE(user_id, week_start, day_of_week, meal_type, meal_id);
    END IF;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_product ON meal_items(product_id);
CREATE INDEX IF NOT EXISTS idx_menu_plan_items_user ON menu_plan_items(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_plan_items_week ON menu_plan_items(week_start);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
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
