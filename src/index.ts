import cron from 'node-cron';
import { TwitchClient } from './clients/twitch.client';
import { MattermostNotifier } from './services/mattermost.notifier';
import { StateManager } from './services/state.manager';
import { InteractiveReceiver } from './services/interactive.receiver';
import { StreamerStateRepository } from './streamerStateRepository';
import { ApiServer } from './server';
import dotenv from 'dotenv';

dotenv.config();

async function runCheck() {
  console.log(`[${new Date().toISOString()}] Checking streamers...`);

  const trackedStreamers = [
    ...(process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean),
    ...(process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean),
    ...(process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean),
  ];
  const uniqueStreamers = [...new Set(trackedStreamers)];

  const config = {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    trackedStreamers: uniqueStreamers,
    interval: process.env.CHECK_INTERVAL || '*/5 * * * *',
  };

  const twitchClient = new TwitchClient({ clientId: config.clientId, clientSecret: config.clientSecret });
  const notifier = new MattermostNotifier();
  const stateManager = new StateManager();

  await stateManager.load();

  try {
    const liveStreams = await twitchClient.getStreamStatus(config.trackedStreamers);
    const liveUsernames = liveStreams.map((s: any) => s.user_login);

    for (const username of config.trackedStreamers) {
      const currentlyLive = liveUsernames.includes(username);
      const previouslyLive = await stateManager.isLive(username);

      if (currentlyLive) {
        const lastNotification = await stateManager.getLastNotificationTime(username);
        const now = new Date();
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        
        const isRecurring = previouslyLive && lastNotification;
        const shouldNotify = !previouslyLive || (lastNotification && new Date(lastNotification) < threeHoursAgo);

        if (shouldNotify) {
          console.log(`Streamer ${username} is live${isRecurring ? ' (recurring notification)' : ' (initial notification)'}! Notifying...`);
          const streamData = liveStreams.find((s: any) => s.user_login === username);
          await notifier.notify(streamData, isRecurring);
          await stateManager.setLastNotificationTime(username, now.toISOString());
        }
      } else if (!currentlyLive && previouslyLive) {
        console.log(`Streamer ${username} went offline.`);
        await stateManager.setLastNotificationTime(username, null);
      }

      await stateManager.setLive(username, currentlyLive);
    }
  } catch (error) {
    console.error('Error during check cycle:', error);
  }
}

const interval = process.env.CHECK_INTERVAL || '*/5 * * * *';
cron.schedule(interval, runCheck);

// Initialize TwitchClient for use in both polling and interactive receiver
const twitchClient = new TwitchClient({ 
  clientId: process.env.TWITCH_CLIENT_ID || '', 
  clientSecret: process.env.TWITCH_CLIENT_SECRET || '' 
});

const notifier = new MattermostNotifier();
const receiver = new InteractiveReceiver(notifier as any, twitchClient);

// Start the API Server for the website and integrate the receiver's routes
const stateRepo = new StreamerStateRepository();
const apiServer = new ApiServer(stateRepo, receiver);
apiServer.start();

// Run immediately on start
runCheck();

console.log(`Twitch Notifier started. Polling every ${interval}`);
