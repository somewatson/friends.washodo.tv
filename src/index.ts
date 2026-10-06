import cron from 'node-cron';
import dotenv from 'dotenv';
import { TwitchClient } from './twitchClient';
import { MattermostNotifier } from './mattermostNotifier';
import { ApiServer } from './server';

dotenv.config();

const twitch = new TwitchClient();
const notifier = new MattermostNotifier();

// Start the API Server
const server = new ApiServer();
server.start();

const washodoMembers = (process.env.WASHODO_MEMBERS || '').split(',');
const washodoFriends = (process.env.WASHODO_FRIENDS || '').split(',');
const trackedStreamers = [...washodoMembers, ...washodoFriends].filter(Boolean);
const checkInterval = process.env.CHECK_INTERVAL || '*/5 * * * *';

// In-memory state to track who was live in the previous check for notifications
let lastKnownStatus: Record<string, { isLive: boolean }> = {};

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
    const currentStatus: Record<string, { isLive: boolean }> = {};
    
    for (const streamer of liveStreamers) {
        const username = streamer.user_login.toLowerCase();
        const wasLive = lastKnownStatus[username]?.isLive || false;
        
        const isMember = washodoMembers.includes(username);
        const isFriend = washodoFriends.includes(username);
        const tier = isMember ? 'Washodo Member' : (isFriend ? 'Washodo Friend' : 'Other');
        
        if (!wasLive) {
            await notifier.sendNotification(streamer, tier);
            logWithTimestamp(`🔔 Notification sent: ${username} (${tier}) is now live!`);
        }
        
        currentStatus[username] = {
            isLive: true
        };
    }

    // Mark everyone else as offline
    for (const username of trackedStreamers) {
        const lowerUser = username.toLowerCase();
        if (!liveUsernames.includes(lowerUser)) {
            currentStatus[lowerUser] = {
                isLive: false
            };
        }
    }

    lastKnownStatus = currentStatus;
    logWithTimestamp('Check complete.');
}

logWithTimestamp(`Hybrid Bot/API started. Monitoring ${trackedStreamers.length} streamers every ${checkInterval}.`);
cron.schedule(checkInterval, checkStreams);

// Run once immediately on start
checkStreams();

// Graceful shutdown
const shutdown = async () => {
    logWithTimestamp('Shutting down gracefully...');
    try {
        await server.stop();
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