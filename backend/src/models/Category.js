const db = require('../config/database');

class Category {
    constructor(data = {}) {
        this.id = data.id;
        this.name = data.name;
        this.icon = data.icon || '📦';
        this.sort_order = data.sort_order || 0;
        this.created_at = data.created_at;
    }

    // Get all categories sorted
    static async findAll() {
        const result = await db.query(
            'SELECT * FROM categories ORDER BY sort_order ASC, name ASC'
        );
        return result.rows.map(row => new Category(row));
    }

    // Find by ID
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM categories WHERE id = $1',
            [id]
        );
        return result.rows[0] ? new Category(result.rows[0]) : null;
    }

    // Find by name
    static async findByName(name) {
        const result = await db.query(
            'SELECT * FROM categories WHERE LOWER(name) = LOWER($1)',
            [name]
        );
        return result.rows[0] ? new Category(result.rows[0]) : null;
    }

    // Create new category
    static async create(name, icon = '📦', sortOrder = 50) {
        const result = await db.query(
            `INSERT INTO categories (name, icon, sort_order) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [name, icon, sortOrder]
        );
        return new Category(result.rows[0]);
    }

    // Update category
    async save() {
        const result = await db.query(
            `UPDATE categories 
             SET name = $1, icon = $2, sort_order = $3 
             WHERE id = $4 
             RETURNING *`,
            [this.name, this.icon, this.sort_order, this.id]
        );
        return result.rows[0] ? new Category(result.rows[0]) : null;
    }

    // Delete category
    async delete() {
        const result = await db.query(
            'DELETE FROM categories WHERE id = $1',
            [this.id]
        );
        return result.rowCount > 0;
    }

    // Get product count for this category
    async getProductCount() {
        const result = await db.query(
            'SELECT COUNT(*) FROM products WHERE category_id = $1',
            [this.id]
        );
        return parseInt(result.rows[0].count);
    }
}

module.exports = Category;

