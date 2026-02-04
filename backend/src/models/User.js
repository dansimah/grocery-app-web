const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

    // Update user password
    static async updatePassword(userId, newPassword) {
        const password_hash = await bcrypt.hash(newPassword, 12);
        const result = await db.query(
            `UPDATE users SET password_hash = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [password_hash, userId]
        );
        return result.rows[0] ? new User(result.rows[0]) : null;
    }

    // Create password reset token
    static async createResetToken(userId) {
        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Invalidate any existing unused tokens for this user
        await db.query(
            `UPDATE password_reset_tokens SET used = TRUE 
             WHERE user_id = $1 AND used = FALSE`,
            [userId]
        );

        // Create new token
        await db.query(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
             VALUES ($1, $2, $3)`,
            [userId, token, expiresAt]
        );

        return { token, expiresAt };
    }

    // Validate reset token and return user
    static async validateResetToken(token) {
        const result = await db.query(
            `SELECT prt.*, u.id as user_id, u.email, u.name 
             FROM password_reset_tokens prt
             JOIN users u ON prt.user_id = u.id
             WHERE prt.token = $1 
               AND prt.used = FALSE 
               AND prt.expires_at > NOW()`,
            [token]
        );

        if (!result.rows[0]) {
            return null;
        }

        return {
            tokenId: result.rows[0].id,
            user: new User({
                id: result.rows[0].user_id,
                email: result.rows[0].email,
                name: result.rows[0].name
            })
        };
    }

    // Mark reset token as used
    static async markTokenUsed(tokenId) {
        await db.query(
            `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
            [tokenId]
        );
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

