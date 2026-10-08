import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testBotAuth() {
    console.log('🔍 Testing Mattermost Bot Authentication...');
    
    const botConfigs = process.env.MATTERMOST_BOTS?.split(',').filter(Boolean) || [];
    
    if (botConfigs.length === 0) {
        console.error('❌ No MATTERMOST_BOTS configured in .env');
        return;
    }

    for (const config of botConfigs) {
        const [token, url, channelId] = config.split('|');
        console.log(`\\nTesting Bot on ${url}...`);
        
        if (!token || !url) {
            console.error('❌ Invalid config format. Expected token|url|channelId');
            continue;
        }

        try {
            const response = await axios.get(`${url.replace(/\/$/, '')}/api/v4/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });
            console.log('✅ AUTH SUCCESS: Bot is authenticated!');
            console.log('User Details:', response.data);
        } catch (error: any) {
            console.error('❌ AUTH FAILED:');
            console.error('Status:', error.response?.status);
            console.error('Data:', error.response?.data || error.message);
        }
    }
}

testBotAuth();
