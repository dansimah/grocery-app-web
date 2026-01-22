const db = require('../config/database');

class MenuPlan {
    // Get the start of the current week (Monday)
    static getWeekStart(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
    }

    // Get menu plan for a week
    static async getWeekPlan(userId, weekStart) {
        const result = await db.query(`
            SELECT 
                mpi.id,
                mpi.day_of_week,
                mpi.meal_type,
                mpi.meal_id,
                m.name as meal_name,
                (SELECT COUNT(*) FROM meal_items WHERE meal_id = m.id) as product_count
            FROM menu_plan_items mpi
            JOIN meals m ON mpi.meal_id = m.id
            WHERE mpi.user_id = $1 AND mpi.week_start = $2
            ORDER BY mpi.day_of_week, mpi.meal_type, m.name
        `, [userId, weekStart]);

        // Group by day and meal_type
        const plan = {};
        for (let i = 0; i < 7; i++) {
            plan[i] = { lunch: [], dinner: [] };
        }
        for (const row of result.rows) {
            const mealType = row.meal_type || 'dinner';
            if (!plan[row.day_of_week][mealType]) {
                plan[row.day_of_week][mealType] = [];
            }
            plan[row.day_of_week][mealType].push({
                id: row.id,
                meal_id: row.meal_id,
                meal_name: row.meal_name,
                meal_type: mealType,
                product_count: parseInt(row.product_count) || 0
            });
        }
        return plan;
    }

    // Add meal to a day
    static async addMealToDay(userId, weekStart, dayOfWeek, mealType, mealId) {
        const result = await db.query(`
            INSERT INTO menu_plan_items (user_id, week_start, day_of_week, meal_type, meal_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, week_start, day_of_week, meal_type, meal_id) DO NOTHING
            RETURNING *
        `, [userId, weekStart, dayOfWeek, mealType, mealId]);
        return result.rows[0];
    }

    // Remove meal from a day
    static async removeMealFromDay(userId, planItemId) {
        const result = await db.query(
            'DELETE FROM menu_plan_items WHERE id = $1 AND user_id = $2',
            [planItemId, userId]
        );
        return result.rowCount > 0;
    }

    // Clear all meals for a day (optionally for a specific meal type)
    static async clearDay(userId, weekStart, dayOfWeek, mealType = null) {
        if (mealType) {
            const result = await db.query(
                'DELETE FROM menu_plan_items WHERE user_id = $1 AND week_start = $2 AND day_of_week = $3 AND meal_type = $4',
                [userId, weekStart, dayOfWeek, mealType]
            );
            return result.rowCount;
        }
        const result = await db.query(
            'DELETE FROM menu_plan_items WHERE user_id = $1 AND week_start = $2 AND day_of_week = $3',
            [userId, weekStart, dayOfWeek]
        );
        return result.rowCount;
    }

    // Get all products needed for the week plan
    static async getWeekProducts(userId, weekStart) {
        const result = await db.query(`
            SELECT DISTINCT 
                p.id,
                p.name,
                c.name as category_name,
                c.icon as category_icon,
                c.sort_order
            FROM menu_plan_items mpi
            JOIN meal_items mi ON mpi.meal_id = mi.meal_id
            JOIN products p ON mi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE mpi.user_id = $1 AND mpi.week_start = $2
            ORDER BY c.sort_order, p.name
        `, [userId, weekStart]);
        return result.rows;
    }

    // Get products for a specific meal in the plan
    static async getMealProducts(mealId) {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                c.name as category_name,
                c.icon as category_icon
            FROM meal_items mi
            JOIN products p ON mi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE mi.meal_id = $1
            ORDER BY c.sort_order, p.name
        `, [mealId]);
        return result.rows;
    }

    // Copy plan from one week to another
    static async copyWeek(userId, fromWeekStart, toWeekStart) {
        // First clear the target week
        await db.query(
            'DELETE FROM menu_plan_items WHERE user_id = $1 AND week_start = $2',
            [userId, toWeekStart]
        );

        // Copy all items including meal_type
        const result = await db.query(`
            INSERT INTO menu_plan_items (user_id, week_start, day_of_week, meal_type, meal_id)
            SELECT user_id, $2, day_of_week, meal_type, meal_id
            FROM menu_plan_items
            WHERE user_id = $1 AND week_start = $3
            RETURNING *
        `, [userId, toWeekStart, fromWeekStart]);
        return result.rows.length;
    }
}

module.exports = MenuPlan;
