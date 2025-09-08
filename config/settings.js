// config/settings.js
const dbConfig = require('./database');

class Settings {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCacheUpdate = 0;
    }

    async getSettings() {
        const now = Date.now();
        
        // ใช้ cache ถ้ายังไม่หมดอายุ
        if (this.cache.size > 0 && (now - this.lastCacheUpdate) < this.cacheExpiry) {
            return Object.fromEntries(this.cache);
        }

        try {
            const settings = await dbConfig.execute(
                'SELECT setting_key, setting_value, setting_type FROM system_settings WHERE is_active = TRUE'
            );

            this.cache.clear();
            
            settings.forEach(setting => {
                let value = setting.setting_value;
                
                switch (setting.setting_type) {
                    case 'number':
                        value = parseFloat(value);
                        break;
                    case 'boolean':
                        value = value.toLowerCase() === 'true';
                        break;
                    case 'json':
                        try {
                            value = JSON.parse(value);
                        } catch (e) {
                            console.warn(`Failed to parse JSON setting: ${setting.setting_key}`);
                        }
                        break;
                }
                
                this.cache.set(setting.setting_key, value);
            });

            this.lastCacheUpdate = now;
            return Object.fromEntries(this.cache);
            
        } catch (error) {
            console.error('Failed to load settings:', error);
            throw error;
        }
    }

    async getSetting(key, defaultValue = null) {
        const settings = await this.getSettings();
        return settings[key] || defaultValue;
    }

    async updateSetting(key, value) {
        try {
            await dbConfig.execute(
                'UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
                [value.toString(), key]
            );
            
            // อัปเดต cache
            this.cache.set(key, value);
            
        } catch (error) {
            console.error(`Failed to update setting ${key}:`, error);
            throw error;
        }
    }

    clearCache() {
        this.cache.clear();
        this.lastCacheUpdate = 0;
    }
}

module.exports = new Settings();