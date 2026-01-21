const db = require('../config/database');

class AILog {
    constructor(data = {}) {
        this.id = data.id;
        this.request_type = data.request_type;
        this.input_text = data.input_text;
        this.success = data.success;
        this.error_message = data.error_message;
        this.error_type = data.error_type;
        this.input_tokens = data.input_tokens || 0;
        this.output_tokens = data.output_tokens || 0;
        this.response_time_ms = data.response_time_ms;
        this.created_at = data.created_at;
    }

    // Create a new log entry
    static async create({ requestType, inputText, success, errorMessage, errorType, inputTokens, outputTokens, responseTimeMs }) {
        try {
            const result = await db.query(`
                INSERT INTO ai_logs 
                (request_type, input_text, success, error_message, error_type, input_tokens, output_tokens, response_time_ms) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                RETURNING *
            `, [
                requestType,
                inputText ? inputText.substring(0, 10000) : null, // Limit text size
                success,
                errorMessage ? errorMessage.substring(0, 1000) : null,
                errorType ? errorType.substring(0, 100) : null,
                inputTokens || 0,
                outputTokens || 0,
                responseTimeMs
            ]);
            return new AILog(result.rows[0]);
        } catch (error) {
            // Don't throw - logging should not break the main flow
            console.error('Failed to save AI log to database:', error.message);
            return null;
        }
    }

    // Find recent logs
    static async findRecent(limit = 50) {
        const result = await db.query(`
            SELECT * FROM ai_logs 
            ORDER BY created_at DESC 
            LIMIT $1
        `, [limit]);
        return result.rows.map(row => new AILog(row));
    }

    // Find recent failures
    static async findFailures(limit = 20) {
        const result = await db.query(`
            SELECT * FROM ai_logs 
            WHERE success = false 
            ORDER BY created_at DESC 
            LIMIT $1
        `, [limit]);
        return result.rows.map(row => new AILog(row));
    }

    // Get aggregated stats from database
    static async getStats(hoursBack = 24) {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE success = true) as successful,
                COUNT(*) FILTER (WHERE success = false) as failed,
                COALESCE(SUM(input_tokens), 0) as total_input_tokens,
                COALESCE(SUM(output_tokens), 0) as total_output_tokens,
                COALESCE(AVG(response_time_ms) FILTER (WHERE success = true), 0) as avg_response_time_ms
            FROM ai_logs 
            WHERE created_at > NOW() - INTERVAL '1 hour' * $1
        `, [hoursBack]);
        return result.rows[0];
    }

    // Clean up old logs (keep last N days)
    static async cleanup(daysToKeep = 7) {
        const result = await db.query(`
            DELETE FROM ai_logs 
            WHERE created_at < NOW() - INTERVAL '1 day' * $1
        `, [daysToKeep]);
        return result.rowCount;
    }
}

module.exports = AILog;
