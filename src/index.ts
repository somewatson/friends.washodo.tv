import cron from 'node-cron';
import dotenv from 'dotenv';
import { TwitchClient } from './twitchClient';
import { WebhookNotifier } from './webhookNotifier';
import { ApiServer } from './server';
import { StreamerStateRepository } from './streamerStateRepository';

dotenv.config();

const twitch = new TwitchClient();
const notifier = new WebhookNotifier();
const stateRepo = new StreamerStateRepository();

// Start the API Server
const server = new ApiServer(stateRepo);
server.start();

const washodoMembers = (process.env.WASHODO_MEMBERS || '').split(',');
const washodoFriends = (process.env.WASHODO_FRIENDS || '').split(',');
const trackedStreamers = [...washodoMembers, ...washodoFriends].filter(Boolean);
const checkInterval = process.env.CHECK_INTERVAL || '*/5 * * * *';

// Helper to get current timestamp for logs
function logWithTimestamp(message: string) {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timestamp}] ${message}`);
}

async function checkStreams() {
    logWithTimestamp('Checking for live streams...');
    const liveStreamers = await twitch.getLiveStreamers(trackedStreamers);
    
    const liveUsernames = liveStreamers.map(s => s.user_login.toLowerCase());
    
    for (const streamer of liveStreamers) {
        const username = streamer.user_login.toLowerCase();
        const wasLive = await stateRepo.isKnownLive(username);
        
        const isMember = washodoMembers.includes(username);
        const isFriend = washodoFriends.includes(username);
        const tier = isMember ? 'Washodo Member' : (isFriend ? 'Washodo Friend' : 'Other');
        
        if (!wasLive) {
            const startTime = streamer.started_at;
            const uptimeText = startTime 
                ? `Live since ${new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Live now!';
            
            await notifier.sendNotification({
                ...streamer,
                uptime: uptimeText
            }, tier);
            
            logWithTimestamp(`🔔 Notification sent: ${username} (${tier}) is now live! ${uptimeText}`);
            await stateRepo.setLive(username, startTime || new Date().toISOString());
        }
    }

    // Mark everyone else as offline
    for (const username of trackedStreamers) {
        const lowerUser = username.toLowerCase();
        if (!liveUsernames.includes(lowerUser)) {
            const wasLive = await stateRepo.isKnownLive(lowerUser);
            if (wasLive) {
                await stateRepo.setOffline(lowerUser);
                logWithTimestamp(`💤 ${lowerUser} is now offline.`);
            }
        }
    }

    logWithTimestamp('Check complete.');
}

async function bootstrap() {
    try {
        await stateRepo.init();
        logWithTimestamp(`Hybrid Bot/API started. Monitoring ${trackedStreamers.length} streamers every ${checkInterval}.`);
        cron.schedule(checkInterval, checkStreams);
        
        // Run once immediately on start
        checkStreams();
    } catch (error) {
        console.error('Failed to bootstrap application:', error);
        process.exit(1);
    }
}

bootstrap();

// Graceful shutdown
const shutdown = async () => {
    logWithTimestamp('Shutting down gracefully...');
    try {
        await server.stop();
        await stateRepo.close();
    } catch (err) {
        console.error('Error during server stop:', err);
    }
    logWithTimestamp('Exiting process.');
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
    shutdown();
});
