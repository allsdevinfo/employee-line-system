// config/database.js
const mysql = require('mysql2/promise');

class DatabaseConfig {
    constructor() {
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'employee_system',
            timezone: '+07:00',
            charset: 'utf8mb4',
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true
        };
        this.pool = null;
    }

    createPool() {
        if (!this.pool) {
            this.pool = mysql.createPool(this.config);
        }
        return this.pool;
    }

    async testConnection() {
        try {
            const pool = this.createPool();
            const connection = await pool.getConnection();
            await connection.execute('SELECT 1');
            connection.release();
            return true;
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async healthCheck() {
        try {
            const start = Date.now();
            await this.execute('SELECT 1');
            return { ok: true, latencyMs: Date.now() - start };
        } catch (err) {
            return { ok: false, error: err.message };
        }
        }

        async getDatabaseStats() {
        try {
            const [status] = await this.execute('SHOW STATUS LIKE "Threads_connected"');
            const [uptime] = await this.execute('SHOW STATUS LIKE "Uptime"');
            return {
            threadsConnected: Number(status?.[0]?.Value || 0),
            uptimeSec: Number(uptime?.[0]?.Value || 0)
            };
        } catch (err) {
            return { error: err.message };
        }
    }

    async execute(sql, params = []) {
        try {
            const pool = this.createPool();
            const [rows/*, fields*/] = await pool.execute(sql, params);
            return [rows]; 
            // const [results] = await pool.execute(sql, params);
            // return results;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async closeConnection() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}

module.exports = new DatabaseConfig();