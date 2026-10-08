import dotenv from 'dotenv';
import { WebhookNotifier } from '../src/webhookNotifier';
import { ApiServer } from '../src/server';

dotenv.config();

async function testNotification() {
    console.log('🚀 Starting test notification for LegitKorea...');
    
    const notifier = new WebhookNotifier();
    
    // Mock LegitKorea data
    const streamer = {
        user_name: 'LegitKorea',
        user_login: 'legitkorea',
        game_name: 'Just Chatting',
        title: 'Testing the notification system with real thumbnails!',
        thumbnail_url: 'https://static-cdn.jtvnw.net/thumbs/v2/aspect_ratio_16x9/123456789/thumbnail.jpg', // Placeholder, will be replaced by actual logic if we were using real API
        profile_image_url: 'https://static-cdn.jtvnw.net/pfp/123456789-f1.jpg'
    };

    // Calculate a "real" status: 11 hours ago
    const elevenHoursAgo = new Date();
    elevenHoursAgo.setHours(elevenHoursAgo.getHours() - 11);
    const startTime = elevenHoursAgo.toISOString();
    
    const uptimeText = `Live for ${ApiServer.formatUptime(startTime)}`;
    
    console.log(`Testing with uptime: ${uptimeText}`);
    
    try {
        await notifier.sendNotification({
            ...streamer,
            uptime: uptimeText
        }, 'Washodo Friend');
        
        console.log('✅ Test notification sent successfully!');
    } catch (error: any) {
        console.error('❌ Test notification failed:', error.message);
    }
}

testNotification();
