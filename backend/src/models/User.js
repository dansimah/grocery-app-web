const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    constructor(data = {}) {
        this.id = data.id;
        this.email = data.email;
        this.password_hash = data.password_hash;
        this.name = data.name;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Create a new user
    static async create(email, password, name) {
        const password_hash = await bcrypt.hash(password, 12);
        const result = await db.query(
            `INSERT INTO users (email, password_hash, name) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [email, password_hash, name]
        );
        return new User(result.rows[0]);
    }

    // Find user by email
    static async findByEmail(email) {
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0] ? new User(result.rows[0]) : null;
    }

    // Find user by ID
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] ? new User(result.rows[0]) : null;
    }

    // Verify password
    async verifyPassword(password) {
        return bcrypt.compare(password, this.password_hash);
    }

    // Return safe user object (without password)
    toJSON() {
        return {
            id: this.id,
            email: this.email,
            name: this.name,
            created_at: this.created_at
        };
    }
}

module.exports = User;

