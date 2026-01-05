const db = require('../config/database');

class GroceryHistory {
    constructor(data = {}) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.product_id = data.product_id;
        this.product_name = data.product_name;
        this.category_name = data.category_name;
        this.quantity = data.quantity || 1;
        this.status = data.status;
        this.completed_at = data.completed_at;
        this.shopping_session_id = data.shopping_session_id;
    }

    // Create history entry from a grocery item
    static async createFromItem(item, sessionId) {
        const result = await db.query(`
            INSERT INTO grocery_history 
            (user_id, product_id, product_name, category_name, quantity, status, shopping_session_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *
        `, [
            item.user_id, 
            item.product_id, 
            item.product_name,
            item.category_name,
            item.quantity, 
            item.status, 
            sessionId
        ]);
        return new GroceryHistory(result.rows[0]);
    }

    // Find all history for a user
    static async findAllByUser(userId, limit = 100) {
        const result = await db.query(`
            SELECT * FROM grocery_history 
            WHERE user_id = $1 
            ORDER BY completed_at DESC 
            LIMIT $2
        `, [userId, limit]);
        return result.rows.map(row => new GroceryHistory(row));
    }

    // Find by session ID
    static async findBySession(userId, sessionId) {
        const result = await db.query(`
            SELECT * FROM grocery_history 
            WHERE user_id = $1 AND shopping_session_id = $2 
            ORDER BY completed_at ASC
        `, [userId, sessionId]);
        return result.rows.map(row => new GroceryHistory(row));
    }

    // Find by status
    static async findByStatus(userId, status, limit = 50) {
        const result = await db.query(`
            SELECT * FROM grocery_history 
            WHERE user_id = $1 AND status = $2 
            ORDER BY completed_at DESC 
            LIMIT $3
        `, [userId, status, limit]);
        return result.rows.map(row => new GroceryHistory(row));
    }

    // Get unique shopping sessions
    static async getSessions(userId, limit = 20) {
        const result = await db.query(`
            SELECT shopping_session_id, 
                   MIN(completed_at) as started_at,
                   MAX(completed_at) as ended_at,
                   COUNT(*) as item_count,
                   COUNT(*) FILTER (WHERE status = 'found') as found_count,
                   COUNT(*) FILTER (WHERE status = 'not_found') as not_found_count
            FROM grocery_history 
            WHERE user_id = $1 AND shopping_session_id IS NOT NULL
            GROUP BY shopping_session_id 
            ORDER BY MAX(completed_at) DESC 
            LIMIT $2
        `, [userId, limit]);
        return result.rows;
    }

    // Find by ID
    static async findById(id, userId) {
        const result = await db.query(
            'SELECT * FROM grocery_history WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        return result.rows[0] ? new GroceryHistory(result.rows[0]) : null;
    }

    // Delete history entry
    async delete() {
        const result = await db.query(
            'DELETE FROM grocery_history WHERE id = $1 AND user_id = $2',
            [this.id, this.user_id]
        );
        return result.rowCount > 0;
    }

    // Clear all history for a user
    static async clearAll(userId) {
        const result = await db.query(
            'DELETE FROM grocery_history WHERE user_id = $1',
            [userId]
        );
        return result.rowCount;
    }
}

module.exports = GroceryHistory;
