// config/line.js
const { Client } = require('@line/bot-sdk');

class LineConfig {
    constructor() {
        this.config = {
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET
        };
        
        this.client = null;
        this.liffId = process.env.LIFF_ID;
    }

    getClient() {
        if (!this.client && this.config.channelAccessToken && this.config.channelSecret) {
            this.client = new Client(this.config);
        }
        return this.client;
    }

    async testConnection() {
        try {
            if (!this.config.channelAccessToken || !this.config.channelSecret) {
                return { success: false, message: 'LINE tokens not configured' };
            }

            const client = this.getClient();
            await client.getBotInfo();
            return { success: true, message: 'LINE connection successful' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async sendMessage(userId, messages) {
        try {
            const client = this.getClient();
            if (!client) {
                throw new Error('LINE client not configured');
            }
            
            await client.pushMessage(userId, messages);
            return true;
        } catch (error) {
            console.error('Failed to send LINE message:', error);
            throw error;
        }
    }

    verifySignature(body, signature) {
        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha256', this.config.channelSecret)
            .update(body, 'utf8')
            .digest('base64');
        
        return hash === signature;
    }
}

module.exports = new LineConfig();