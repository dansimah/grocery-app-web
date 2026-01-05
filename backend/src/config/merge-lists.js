/**
 * Migration script to merge grocery lists from all users into a shared list.
 * This consolidates duplicate products (same product_id) by summing quantities.
 * Run once after deploying the shared list changes.
 * 
 * Usage: node src/config/merge-lists.js
 */

require('dotenv').config();
const { pool } = require('./database');

async function mergeLists() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting list merge...');
        
        await client.query('BEGIN');
        
        // Step 1: Find all duplicate products (same product_id across users)
        const duplicates = await client.query(`
            SELECT product_id, 
                   SUM(quantity) as total_quantity,
                   string_agg(DISTINCT note, '; ') as merged_notes,
                   MIN(status) as status,
                   MIN(created_at) as created_at,
                   COUNT(*) as count
            FROM grocery_items
            WHERE status != 'found'
            GROUP BY product_id
            HAVING COUNT(*) > 1
        `);
        
        console.log(`📦 Found ${duplicates.rows.length} products with duplicates`);
        
        // Step 2: For each duplicate, keep one and update it, delete the rest
        for (const dup of duplicates.rows) {
            // Find the oldest entry to keep
            const oldest = await client.query(`
                SELECT id FROM grocery_items 
                WHERE product_id = $1 AND status != 'found'
                ORDER BY created_at ASC
                LIMIT 1
            `, [dup.product_id]);
            
            if (oldest.rows.length > 0) {
                const keepId = oldest.rows[0].id;
                
                // Update the keeper with merged data
                await client.query(`
                    UPDATE grocery_items 
                    SET quantity = $1, note = $2, updated_at = NOW()
                    WHERE id = $3
                `, [dup.total_quantity, dup.merged_notes, keepId]);
                
                // Delete all others
                const deleted = await client.query(`
                    DELETE FROM grocery_items 
                    WHERE product_id = $1 AND id != $2 AND status != 'found'
                `, [dup.product_id, keepId]);
                
                console.log(`  ✅ Merged ${dup.count} entries for product ${dup.product_id} (total qty: ${dup.total_quantity})`);
            }
        }
        
        // Step 3: Set all remaining items to user_id = 1 (or first user)
        const firstUser = await client.query('SELECT id FROM users ORDER BY id LIMIT 1');
        if (firstUser.rows.length > 0) {
            const userId = firstUser.rows[0].id;
            await client.query('UPDATE grocery_items SET user_id = $1', [userId]);
            console.log(`📝 Set all items to user_id = ${userId}`);
        }
        
        await client.query('COMMIT');
        
        // Summary
        const summary = await client.query('SELECT COUNT(*) as count FROM grocery_items');
        console.log(`\n🎉 Merge complete! Total items in shared list: ${summary.rows[0].count}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error during merge:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

mergeLists().catch(console.error);

