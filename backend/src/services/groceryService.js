const crypto = require('crypto');
const db = require('../config/database');
const GroceryItem = require('../models/GroceryItem');
const GroceryHistory = require('../models/GroceryHistory');
const Product = require('../models/Product');
const aiService = require('./aiService');
const productService = require('./productService');

class GroceryService {
    // Parse and add items (with product lookup + AI fallback)
    async parseAndAddItems(userId, groceryText) {
        try {
            const lines = groceryText.split('\n').filter(line => line.trim().length > 0);
            
            // Step 1: Try to find products in our database
            const { found, notFound } = await productService.parseLines(lines);
            
            // Step 2: Use AI for items not found
            let aiItems = [];
            if (notFound.length > 0) {
                console.log(`🤖 Sending ${notFound.length} items to AI...`);
                const unparsedText = notFound.map(item => item.originalInput).join('\n');
                const aiParsed = await aiService.parseGroceryItems(unparsedText);
                
                // Process AI results - learn and create products
                for (let i = 0; i < aiParsed.length; i++) {
                    const parsed = aiParsed[i];
                    const original = notFound[i];
                    
                    if (parsed.article && parsed.category) {
                        // Learn from AI (creates product + alias)
                        const product = await productService.learnFromAI(
                            parsed.article,
                            parsed.category,
                            original.term
                        );
                        
                        aiItems.push({
                            product,
                            quantity: original.quantity || parsed.quantity || 1,
                            originalInput: original.originalInput
                        });
                    }
                }
            } else {
                console.log('✨ All items found in database, skipping AI!');
            }
            
            // Step 3: Combine found items and AI-processed items
            const allItems = [...found, ...aiItems];
            
            // Generate batch ID
            const batchId = crypto.randomBytes(4).toString('hex');
            
            // Step 4: Add items to grocery list
            const addedItems = [];
            for (const item of allItems) {
                if (!item.product) continue;
                
                // Check if product already in list
                const existing = await GroceryItem.findByProduct(userId, item.product.id);
                
                if (existing) {
                    // Update quantity
                    existing.quantity += item.quantity;
                    existing.batch_id = batchId;
                    await existing.save();
                    addedItems.push(await GroceryItem.findById(existing.id, userId));
                } else {
                    // Create new item
                    const groceryItem = new GroceryItem({
                        user_id: userId,
                        product_id: item.product.id,
                        quantity: item.quantity,
                        status: 'pending',
                        batch_id: batchId
                    });
                    const saved = await groceryItem.save();
                    // Fetch with joins to get full data
                    addedItems.push(await GroceryItem.findById(saved.id, userId));
                }
            }
            
            console.log(`✅ Added batch ${batchId}: ${addedItems.length} items (${found.length} cached, ${aiItems.length} from AI)`);
            
            return { 
                batchId, 
                items: addedItems,
                stats: {
                    total: addedItems.length,
                    fromCache: found.length,
                    fromAI: aiItems.length
                }
            };
            
        } catch (error) {
            console.error('Error parsing and adding items:', error);
            throw error;
        }
    }

    // Get all items sorted by category
    async getAllItemsSorted(userId) {
        try {
            const allItems = await GroceryItem.findAllByUser(userId);
            
            // Separate found items
            const foundItems = allItems.filter(item => item.status === 'found');
            
            // Get active items (all statuses except 'found')
            const activeItems = allItems.filter(item => item.status !== 'found');
            
            // Group by category
            const grouped = {};
            for (const item of activeItems) {
                const category = item.category_name || 'Autre';
                if (!grouped[category]) {
                    grouped[category] = {
                        items: [],
                        icon: item.category_icon || '📦',
                        sort_order: item.category_sort || 99
                    };
                }
                grouped[category].items.push(item);
            }
            
            // Sort categories
            const sortedGrouped = {};
            Object.keys(grouped)
                .sort((a, b) => grouped[a].sort_order - grouped[b].sort_order)
                .forEach(key => {
                    sortedGrouped[key] = grouped[key].items;
                });
            
            return {
                allItems,
                activeItems,
                foundItems,
                grouped: sortedGrouped,
                categoryInfo: Object.fromEntries(
                    Object.entries(grouped).map(([k, v]) => [k, { icon: v.icon }])
                )
            };
        } catch (error) {
            console.error('Error getting sorted items:', error);
            throw error;
        }
    }

    // Complete shopping session - move found/not_found items to history
    // Uses database transaction to ensure atomicity
    async completeShoppingSession(userId) {
        const sessionId = crypto.randomBytes(4).toString('hex');
        
        try {
            const result = await db.withTransaction(async (client) => {
                // Get all items that are found or not_found
                const foundItems = await GroceryItem.findByStatus(userId, 'found');
                const notFoundItems = await GroceryItem.findByStatus(userId, 'not_found');
                
                const itemsToArchive = [...foundItems, ...notFoundItems];
                let archivedCount = 0;

                for (const item of itemsToArchive) {
                    // Add to history (uses the transaction client)
                    await client.query(`
                        INSERT INTO grocery_history 
                        (user_id, product_id, product_name, category_name, quantity, status, shopping_session_id) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        item.user_id, 
                        item.product_id, 
                        item.product_name,
                        item.category_name,
                        item.quantity, 
                        item.status, 
                        sessionId
                    ]);
                    
                    // Delete from active list - SHARED LIST: no user check
                    await client.query(
                        'DELETE FROM grocery_items WHERE id = $1',
                        [item.id]
                    );
                    archivedCount++;
                }

                return {
                    archivedCount,
                    foundCount: foundItems.length,
                    notFoundCount: notFoundItems.length
                };
            });

            console.log(`🛒 Completed shopping session ${sessionId}: archived ${result.archivedCount} items`);
            
            return {
                sessionId,
                ...result
            };
        } catch (error) {
            console.error('Error completing shopping session:', error);
            throw error;
        }
    }

    // Add single item by product ID
    async addItemByProduct(userId, productId, quantity = 1, note = null) {
        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            throw new Error('Product not found');
        }

        // Check if already in list
        const existing = await GroceryItem.findByProduct(userId, productId);
        if (existing) {
            existing.quantity += quantity;
            if (note) existing.note = note;
            await existing.save();
            return GroceryItem.findById(existing.id, userId);
        }

        // Create new item
        const item = new GroceryItem({
            user_id: userId,
            product_id: productId,
            quantity,
            note,
            status: 'pending'
        });
        const saved = await item.save();
        return GroceryItem.findById(saved.id, userId);
    }
}

// Create singleton instance
const groceryService = new GroceryService();

module.exports = groceryService;
