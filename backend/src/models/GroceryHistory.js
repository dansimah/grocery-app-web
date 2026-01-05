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

    // Find all history - SHARED LIST: returns all history
    static async findAllByUser(userId, limit = 100) {
        const result = await db.query(`
            SELECT * FROM grocery_history 
            ORDER BY completed_at DESC 
            LIMIT $1
        `, [limit]);
        return result.rows.map(row => new GroceryHistory(row));
    }

    // Find by session ID - SHARED LIST
    static async findBySession(userId, sessionId) {
        const result = await db.query(`
            SELECT * FROM grocery_history 
            WHERE shopping_session_id = $1 
            ORDER BY completed_at ASC
        `, [sessionId]);
        return result.rows.map(row => new GroceryHistory(row));
    }

    // Find by status - SHARED LIST
    static async findByStatus(userId, status, limit = 50) {
        const result = await db.query(`
            SELECT * FROM grocery_history 
            WHERE status = $1 
            ORDER BY completed_at DESC 
            LIMIT $2
        `, [status, limit]);
        return result.rows.map(row => new GroceryHistory(row));
    }

    // Get unique shopping sessions - SHARED LIST
    static async getSessions(userId, limit = 20) {
        const result = await db.query(`
            SELECT shopping_session_id, 
                   MIN(completed_at) as started_at,
                   MAX(completed_at) as ended_at,
                   COUNT(*) as item_count,
                   COUNT(*) FILTER (WHERE status = 'found') as found_count,
                   COUNT(*) FILTER (WHERE status = 'not_found') as not_found_count
            FROM grocery_history 
            WHERE shopping_session_id IS NOT NULL
            GROUP BY shopping_session_id 
            ORDER BY MAX(completed_at) DESC 
            LIMIT $1
        `, [limit]);
        return result.rows;
    }

    // Find by ID - SHARED LIST
    static async findById(id, userId) {
        const result = await db.query(
            'SELECT * FROM grocery_history WHERE id = $1',
            [id]
        );
        return result.rows[0] ? new GroceryHistory(result.rows[0]) : null;
    }

    // Delete history entry - SHARED LIST
    async delete() {
        const result = await db.query(
            'DELETE FROM grocery_history WHERE id = $1',
            [this.id]
        );
        return result.rowCount > 0;
    }

    // Clear all history - SHARED LIST
    static async clearAll(userId) {
        const result = await db.query(
            'DELETE FROM grocery_history'
        );
        return result.rowCount;
    }
}

module.exports = GroceryHistory;
