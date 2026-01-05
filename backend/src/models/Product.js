const db = require('../config/database');

class Product {
    constructor(data = {}) {
        this.id = data.id;
        this.name = data.name;
        this.category_id = data.category_id;
        this.category_name = data.category_name; // From join
        this.category_icon = data.category_icon; // From join
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Get all products with category info
    static async findAll() {
        const result = await db.query(`
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY c.sort_order ASC, p.name ASC
        `);
        return result.rows.map(row => new Product(row));
    }

    // Find by ID
    static async findById(id) {
        const result = await db.query(`
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1
        `, [id]);
        return result.rows[0] ? new Product(result.rows[0]) : null;
    }

    // Find by exact name
    static async findByName(name) {
        const result = await db.query(`
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE LOWER(p.name) = LOWER($1)
        `, [name]);
        return result.rows[0] ? new Product(result.rows[0]) : null;
    }

    // Find by alias
    static async findByAlias(alias) {
        const result = await db.query(`
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            JOIN product_aliases pa ON p.id = pa.product_id
            WHERE LOWER(pa.alias) = LOWER($1)
        `, [alias]);
        return result.rows[0] ? new Product(result.rows[0]) : null;
    }

    // Generate plural/singular variants of a term
    static getPluralVariants(term) {
        const variants = [term];
        
        // If ends with 's', try without it (plural -> singular)
        if (term.endsWith('s') && term.length > 2) {
            variants.push(term.slice(0, -1));
            // Handle 'es' ending (e.g., "tomatoes" -> "tomato")
            if (term.endsWith('es') && term.length > 3) {
                variants.push(term.slice(0, -2));
            }
        } else {
            // Try adding 's' (singular -> plural)
            variants.push(term + 's');
        }
        
        return [...new Set(variants)]; // Remove duplicates
    }

    // Find by name or alias (main lookup method)
    static async lookup(term) {
        const normalized = term.toLowerCase().trim();
        const variants = Product.getPluralVariants(normalized);
        
        // Try each variant
        for (const variant of variants) {
            // Try exact name match first
            let product = await Product.findByName(variant);
            if (product) return product;

            // Try alias match
            product = await Product.findByAlias(variant);
            if (product) return product;
        }
        
        return null;
    }

    // Find products by category
    static async findByCategory(categoryId) {
        const result = await db.query(`
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.category_id = $1
            ORDER BY p.name ASC
        `, [categoryId]);
        return result.rows.map(row => new Product(row));
    }

    // Create new product
    static async create(name, categoryId) {
        const result = await db.query(`
            INSERT INTO products (name, category_id) 
            VALUES ($1, $2) 
            RETURNING *
        `, [name, categoryId]);
        return new Product(result.rows[0]);
    }

    // Update product
    async save() {
        const result = await db.query(`
            UPDATE products 
            SET name = $1, category_id = $2, updated_at = NOW() 
            WHERE id = $3 
            RETURNING *
        `, [this.name, this.category_id, this.id]);
        return result.rows[0] ? new Product(result.rows[0]) : null;
    }

    // Delete product (cascades to aliases and affects grocery_items)
    async delete() {
        const result = await db.query(
            'DELETE FROM products WHERE id = $1',
            [this.id]
        );
        return result.rowCount > 0;
    }

    // Get aliases for this product
    async getAliases() {
        const result = await db.query(
            'SELECT alias FROM product_aliases WHERE product_id = $1 ORDER BY alias',
            [this.id]
        );
        return result.rows.map(r => r.alias);
    }

    // Add alias
    async addAlias(alias) {
        const normalized = alias.toLowerCase().trim();
        if (normalized === this.name.toLowerCase()) return false;
        
        try {
            await db.query(
                'INSERT INTO product_aliases (product_id, alias) VALUES ($1, $2) ON CONFLICT (alias) DO NOTHING',
                [this.id, normalized]
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    // Remove alias
    async removeAlias(alias) {
        const result = await db.query(
            'DELETE FROM product_aliases WHERE product_id = $1 AND alias = $2',
            [this.id, alias.toLowerCase()]
        );
        return result.rowCount > 0;
    }

    // Search products by partial name or alias (includes plural/singular variants)
    static async search(query, limit = 20) {
        const normalized = query.toLowerCase().trim();
        const variants = Product.getPluralVariants(normalized);
        
        // Build OR conditions for all variants (search both name and aliases)
        const nameConditions = variants.map((_, i) => `LOWER(p.name) LIKE LOWER($${i + 1})`).join(' OR ');
        const aliasConditions = variants.map((_, i) => `LOWER(pa.alias) LIKE LOWER($${i + 1})`).join(' OR ');
        const params = variants.map(v => `%${v}%`);
        params.push(limit);
        
        const result = await db.query(`
            SELECT DISTINCT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_aliases pa ON p.id = pa.product_id
            WHERE (${nameConditions}) OR (${aliasConditions})
            ORDER BY p.name ASC
            LIMIT $${params.length}
        `, params);
        return result.rows.map(row => new Product(row));
    }
}

module.exports = Product;

