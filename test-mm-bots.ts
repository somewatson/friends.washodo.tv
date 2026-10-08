import dotenv from 'dotenv';
import { WebhookNotifier } from './src/webhookNotifier';

dotenv.config();

async function testBots() {
    console.log('🚀 Starting Mattermost Bot Test...');
    
    const notifier = new WebhookNotifier();
    const testStreamer = {
        user_name: 'Test Bot',
        user_login: 'testbot',
        game_name: 'Testing',
        title: 'This is a manual test of the Mattermost Bot integration!',
        uptime: '10 minutes'
    };

    try {
        await notifier.sendNotification(testStreamer, 'System Test');
        console.log('✅ Notification process completed. Check your Mattermost channels!');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testBots();
