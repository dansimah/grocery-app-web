const db = require('../config/database');

class Meal {
    constructor(data = {}) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.name = data.name;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.product_count = data.product_count;
        this.products = data.products || [];
    }

    // Get all meals for a user with product counts
    static async findAllByUser(userId) {
        const result = await db.query(`
            SELECT m.*, 
                   COUNT(mi.id) as product_count
            FROM meals m
            LEFT JOIN meal_items mi ON m.id = mi.meal_id
            WHERE m.user_id = $1
            GROUP BY m.id
            ORDER BY m.name ASC
        `, [userId]);
        return result.rows.map(row => new Meal({
            ...row,
            product_count: parseInt(row.product_count) || 0
        }));
    }

    // Get meal by ID with its products
    static async findById(id, userId) {
        const mealResult = await db.query(`
            SELECT * FROM meals WHERE id = $1 AND user_id = $2
        `, [id, userId]);

        if (!mealResult.rows[0]) return null;

        const productsResult = await db.query(`
            SELECT p.id, p.name, c.name as category_name, c.icon as category_icon
            FROM meal_items mi
            JOIN products p ON mi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE mi.meal_id = $1
            ORDER BY p.name ASC
        `, [id]);

        return new Meal({
            ...mealResult.rows[0],
            products: productsResult.rows
        });
    }

    // Create meal with products
    static async create(userId, name, productIds = []) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Create meal
            const mealResult = await client.query(`
                INSERT INTO meals (user_id, name)
                VALUES ($1, $2)
                RETURNING *
            `, [userId, name]);

            const meal = mealResult.rows[0];

            // Add products
            if (productIds.length > 0) {
                const values = productIds.map((productId, i) => 
                    `($1, $${i + 2})`
                ).join(', ');
                await client.query(
                    `INSERT INTO meal_items (meal_id, product_id) VALUES ${values}`,
                    [meal.id, ...productIds]
                );
            }

            await client.query('COMMIT');

            // Fetch full meal with products
            return await Meal.findById(meal.id, userId);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Update meal name and products
    static async update(id, userId, name, productIds = []) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Update meal name
            const mealResult = await client.query(`
                UPDATE meals 
                SET name = $1, updated_at = NOW()
                WHERE id = $2 AND user_id = $3
                RETURNING *
            `, [name, id, userId]);

            if (!mealResult.rows[0]) {
                throw new Error('Meal not found');
            }

            // Delete existing products and re-add
            await client.query('DELETE FROM meal_items WHERE meal_id = $1', [id]);

            if (productIds.length > 0) {
                const values = productIds.map((productId, i) => 
                    `($1, $${i + 2})`
                ).join(', ');
                await client.query(
                    `INSERT INTO meal_items (meal_id, product_id) VALUES ${values}`,
                    [id, ...productIds]
                );
            }

            await client.query('COMMIT');

            // Fetch full meal with products
            return await Meal.findById(id, userId);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Delete meal
    static async delete(id, userId) {
        const result = await db.query(
            'DELETE FROM meals WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        return result.rowCount > 0;
    }
}

module.exports = Meal;
