import cron from 'node-cron';
import dotenv from 'dotenv';
import { TwitchClient } from './twitchClient';
import { MattermostNotifier } from './mattermostNotifier';
import { StateManager } from './stateManager';
import { ApiServer } from './server';

dotenv.config();

const twitch = new TwitchClient();
const notifier = new MattermostNotifier();
const state = new StateManager();

// Start the API Server
const server = new ApiServer();
server.start();

const trackedStreamers = (process.env.TRACKED_STREAMERS || '').split(',');
const checkInterval = process.env.CHECK_INTERVAL || '*/5 * * * *';

async function checkStreams() {
    console.log('Checking for live streams...');
    const currentStatus = state.loadState();
    const liveStreamers = await twitch.getLiveStreamers(trackedStreamers);
    
    const liveUsernames = liveStreamers.map(s => s.user_login.toLowerCase());
    
    for (const streamer of liveStreamers) {
        const username = streamer.user_login.toLowerCase();
        const wasLive = currentStatus[username]?.isLive || false;
        
        if (!wasLive) {
            await notifier.sendNotification(streamer);
        }
        
        currentStatus[username] = {
            isLive: true,
            lastLive: currentStatus[username]?.lastLive || new Date().toISOString()
        };
    }

    // Mark streamers who went offline and update lastLive timestamp
    for (const username in currentStatus) {
        if (!liveUsernames.includes(username)) {
            currentStatus[username] = {
                isLive: false,
                lastLive: currentStatus[username].lastLive || new Date().toISOString()
            };
        }
    }

    state.saveState(currentStatus);
    console.log('Check complete.');
}

console.log(`Hybrid Bot/API started. Monitoring ${trackedStreamers.length} streamers every ${checkInterval}.`);
cron.schedule(checkInterval, checkStreams);

// Run once immediately on start
checkStreams();
