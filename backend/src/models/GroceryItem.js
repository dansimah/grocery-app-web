const db = require('../config/database');

class GroceryItem {
    constructor(data = {}) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.product_id = data.product_id;
        this.quantity = data.quantity || 1;
        this.status = data.status || 'pending';
        this.batch_id = data.batch_id;
        this.note = data.note || null;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        // From joins
        this.product_name = data.product_name;
        this.category_id = data.category_id;
        this.category_name = data.category_name;
        this.category_icon = data.category_icon;
    }

    // Base query with joins
    static get baseQuery() {
        return `
            SELECT gi.*, 
                   p.name as product_name, 
                   p.category_id,
                   c.name as category_name, 
                   c.icon as category_icon,
                   c.sort_order as category_sort
            FROM grocery_items gi
            JOIN products p ON gi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
        `;
    }

    // Save item (create or update)
    async save() {
        if (this.id) {
            const result = await db.query(`
                UPDATE grocery_items 
                SET product_id = $1, quantity = $2, status = $3, 
                    batch_id = $4, note = $5, updated_at = NOW() 
                WHERE id = $6 AND user_id = $7
                RETURNING *
            `, [this.product_id, this.quantity, this.status, 
                this.batch_id, this.note, this.id, this.user_id]);
            return result.rows[0] ? new GroceryItem(result.rows[0]) : null;
        } else {
            const result = await db.query(`
                INSERT INTO grocery_items (user_id, product_id, quantity, status, batch_id, note) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING *
            `, [this.user_id, this.product_id, this.quantity, 
                this.status, this.batch_id, this.note]);
            return new GroceryItem(result.rows[0]);
        }
    }

    // Find all items for a user (with product/category info)
    static async findAllByUser(userId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.user_id = $1 
            ORDER BY c.sort_order ASC, p.name ASC
        `, [userId]);
        return result.rows.map(row => new GroceryItem(row));
    }

    // Find items by status for a user
    static async findByStatus(userId, status) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.user_id = $1 AND gi.status = $2 
            ORDER BY c.sort_order ASC, p.name ASC
        `, [userId, status]);
        return result.rows.map(row => new GroceryItem(row));
    }

    // Find item by ID (with user check)
    static async findById(id, userId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.id = $1 AND gi.user_id = $2
        `, [id, userId]);
        return result.rows[0] ? new GroceryItem(result.rows[0]) : null;
    }

    // Find by product for a user (to check if already in list)
    static async findByProduct(userId, productId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.user_id = $1 AND gi.product_id = $2 AND gi.status != 'found'
        `, [userId, productId]);
        return result.rows[0] ? new GroceryItem(result.rows[0]) : null;
    }

    // Find by batch ID
    static async findByBatchId(userId, batchId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.user_id = $1 AND gi.batch_id = $2 
            ORDER BY gi.created_at ASC
        `, [userId, batchId]);
        return result.rows.map(row => new GroceryItem(row));
    }

    // Update status
    static async updateStatus(id, userId, status) {
        const result = await db.query(`
            UPDATE grocery_items 
            SET status = $1, updated_at = NOW() 
            WHERE id = $2 AND user_id = $3 
            RETURNING *
        `, [status, id, userId]);
        
        if (result.rows[0]) {
            return GroceryItem.findById(id, userId);
        }
        return null;
    }

    // Delete item
    async delete() {
        const result = await db.query(
            'DELETE FROM grocery_items WHERE id = $1 AND user_id = $2',
            [this.id, this.user_id]
        );
        return result.rowCount > 0;
    }

    // Delete by status
    static async deleteByStatus(userId, status) {
        const result = await db.query(
            'DELETE FROM grocery_items WHERE user_id = $1 AND status = $2',
            [userId, status]
        );
        return result.rowCount;
    }

    // Delete batch
    static async deleteBatch(userId, batchId) {
        const result = await db.query(
            'DELETE FROM grocery_items WHERE user_id = $1 AND batch_id = $2',
            [userId, batchId]
        );
        return result.rowCount;
    }

    // Clear all items for a user
    static async clearAll(userId) {
        const result = await db.query(
            'DELETE FROM grocery_items WHERE user_id = $1',
            [userId]
        );
        return result.rowCount;
    }
}

module.exports = GroceryItem;
