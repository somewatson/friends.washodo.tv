import dotenv from 'dotenv';
import { TwitchClient } from '../src/twitchClient';
import { WebhookNotifier } from '../src/webhookNotifier';
import { ApiServer } from '../src/server';

dotenv.config();

async function testNotificationWithRealData() {
    console.log('🚀 Fetching real data for LegitKorea...');
    
    const twitch = new TwitchClient();
    const notifier = new WebhookNotifier();
    
    try {
        // 1. Get actual live status and thumbnail
        const liveStreams = await twitch.getLiveStreamers(['legitkorea']);
        let target: any;

        if (liveStreams && liveStreams.length > 0) {
            target = liveStreams[0];
            console.log('✅ LegitKorea is live! Using real stream data.');
        } else {
            console.log('⚠️ LegitKorea is not live right now. Trying to find ANY live tracked streamer for a real thumbnail test...');
            const washodoMembers = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
            const washodoFriends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
            const allTracked = [...washodoMembers, ...washodoFriends];
            
            const anyLive = await twitch.getLiveStreamers(allTracked);
            if (anyLive && anyLive.length > 0) {
                target = anyLive[0];
                console.log(`Using ${target.user_login} as a live example for thumbnail verification.`);
            } else {
                console.log('❌ No tracked streamers are live. Using a hardcoded real Twitch thumbnail for render check.');
                target = {
                    user_name: 'Verification Test',
                    user_login: 'testuser',
                    game_name: 'System Test',
                    title: 'Testing Image Rendering',
                    thumbnail_url: 'https://static-cdn.jtvnw.net/thumbs/v2/aspect_ratio_16x9/321432143/thumbnail.jpg', 
                };
            }
        }

        // 2. Calculate "real" status: 11 hours ago
        const elevenHoursAgo = new Date();
        elevenHoursAgo.setHours(elevenHoursAgo.getHours() - 11);
        const startTime = elevenHoursAgo.toISOString();
        const uptimeText = `Live for ${ApiServer.formatUptime(startTime)}`;
        
        console.log(`Sending notification for ${target.user_login} with uptime: ${uptimeText}`);
        
        await notifier.sendNotification({
            ...target,
            uptime: uptimeText
        }, 'Washodo Friend');
        
        console.log('✅ Test notification sent successfully!');
    } catch (error: any) {
        console.error('❌ Test notification failed:', error.message);
    }
}

testNotificationWithRealData();
