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

    // Save item (create or update) - SHARED LIST: no user_id check on update
    async save() {
        if (this.id) {
            const result = await db.query(`
                UPDATE grocery_items 
                SET product_id = $1, quantity = $2, status = $3, 
                    batch_id = $4, note = $5, updated_at = NOW() 
                WHERE id = $6
                RETURNING *
            `, [this.product_id, this.quantity, this.status, 
                this.batch_id, this.note, this.id]);
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

    // Find all items - SHARED LIST: returns all items regardless of user
    static async findAllByUser(userId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            ORDER BY c.sort_order ASC, p.name ASC
        `);
        return result.rows.map(row => new GroceryItem(row));
    }

    // Find items by status - SHARED LIST: returns all items with status
    static async findByStatus(userId, status) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.status = $1 
            ORDER BY c.sort_order ASC, p.name ASC
        `, [status]);
        return result.rows.map(row => new GroceryItem(row));
    }

    // Find item by ID - SHARED LIST: no user check
    static async findById(id, userId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.id = $1
        `, [id]);
        return result.rows[0] ? new GroceryItem(result.rows[0]) : null;
    }

    // Find by product - SHARED LIST: check by product_id only
    static async findByProduct(userId, productId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.product_id = $1 AND gi.status != 'found'
        `, [productId]);
        return result.rows[0] ? new GroceryItem(result.rows[0]) : null;
    }

    // Find by batch ID - SHARED LIST
    static async findByBatchId(userId, batchId) {
        const result = await db.query(`
            ${GroceryItem.baseQuery}
            WHERE gi.batch_id = $1 
            ORDER BY gi.created_at ASC
        `, [batchId]);
        return result.rows.map(row => new GroceryItem(row));
    }

    // Update status - SHARED LIST: no user check
    static async updateStatus(id, userId, status) {
        const result = await db.query(`
            UPDATE grocery_items 
            SET status = $1, updated_at = NOW() 
            WHERE id = $2 
            RETURNING *
        `, [status, id]);
        
        if (result.rows[0]) {
            return GroceryItem.findById(id, userId);
        }
        return null;
    }

    // Delete item - SHARED LIST: no user check
    async delete() {
        const result = await db.query(
            'DELETE FROM grocery_items WHERE id = $1',
            [this.id]
        );
        return result.rowCount > 0;
    }

    // Delete by status - SHARED LIST: deletes all with status
    static async deleteByStatus(userId, status) {
        const result = await db.query(
            'DELETE FROM grocery_items WHERE status = $1',
            [status]
        );
        return result.rowCount;
    }

    // Delete batch - SHARED LIST
    static async deleteBatch(userId, batchId) {
        const result = await db.query(
            'DELETE FROM grocery_items WHERE batch_id = $1',
            [batchId]
        );
        return result.rowCount;
    }

    // Clear all items - SHARED LIST: clears everything
    static async clearAll(userId) {
        const result = await db.query(
            'DELETE FROM grocery_items'
        );
        return result.rowCount;
    }
}

module.exports = GroceryItem;
