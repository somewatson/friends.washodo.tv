import cron from 'node-cron';
import { TwitchClient } from './twitchClient';
import { MattermostNotifier } from './services/mattermost.notifier';
import { DiscordNotifier } from './services/discord.notifier';
import { StateManager } from './services/state.manager';
import { InteractiveReceiver } from './services/interactive.receiver';
import { StreamerStateRepository } from './streamerStateRepository';
import { ApiServer } from './server';
import { BotAccountRepository } from './repositories/botAccountRepository';
import { TwitchTokenService } from './services/twitchTokenService';
import { TwitchChatBot } from './services/twitchChatBot';
import dotenv from 'dotenv';

dotenv.config();

async function runCheck(
  twitchClient: TwitchClient, 
  mattermostNotifier: MattermostNotifier, 
  discordNotifier: DiscordNotifier, 
  stateManager: StateManager
) {
  console.log(`[${new Date().toISOString()}] Checking streamers...`);

  const trackedStreamers = [
    ...(process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean),
    ...(process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean),
    ...(process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean),
  ];
  const uniqueStreamers = [...new Set(trackedStreamers)];

  try {
    const liveStreams = await twitchClient.getStreamStatus(uniqueStreamers);
    const liveUsernames = liveStreams.map((s: any) => s.user_login);

    for (const username of uniqueStreamers) {
      const currentlyLive = liveUsernames.includes(username);
      const previouslyLive = await stateManager.isLive(username);

      if (currentlyLive) {
        const streamData = liveStreams.find((s: any) => s.user_login === username);
        
        // Both notifiers now handle their own "shouldNotify" check using the DB log
        const isRecurring = !!previouslyLive;
        
        await Promise.all([
          mattermostNotifier.notify(streamData, isRecurring),
          discordNotifier.notify(streamData, isRecurring)
        ]);

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
// The cron schedule is now handled inside bootstrap() to ensure access to initialized services.

async function bootstrap() {
  try {
    // Initialize State Repository first
    const stateRepo = new StreamerStateRepository();
    await stateRepo.init();

    // Initialize Bot Account Repository
    const botRepo = new BotAccountRepository();
    await botRepo.init();

    // Initialize Token Service
    const tokenService = new TwitchTokenService(botRepo);

    // Initialize TwitchClient for use in both polling and interactive receiver
    const twitchClient = new TwitchClient({ 
      clientId: process.env.TWITCH_CLIENT_ID || '', 
      clientSecret: process.env.TWITCH_CLIENT_SECRET || '' 
    });

    // Initialize Notifiers
    const mattermostNotifier = new MattermostNotifier(stateRepo);
    const discordNotifier = new DiscordNotifier(stateRepo, twitchClient);
    await discordNotifier.start();

    const stateManager = new StateManager();
    await stateManager.load();

    const receiver = new InteractiveReceiver(mattermostNotifier as any, twitchClient);

    // Start the API Server for the website and integrate the receiver's routes
    const apiServer = new ApiServer(stateRepo, botRepo, receiver);
    apiServer.start();

    // Start the Twitch Chat Bot
    const twitchBot = new TwitchChatBot(tokenService, stateRepo, twitchClient);
    await twitchBot.start();

    // Set up the cron job with the initialized services
    const intervalStr = process.env.CHECK_INTERVAL || '*/5 * * * *';
    cron.schedule(intervalStr, () => runCheck(twitchClient, mattermostNotifier, discordNotifier, stateManager));

    // Run immediately on start
    await runCheck(twitchClient, mattermostNotifier, discordNotifier, stateManager);

    console.log(`Twitch Notifier started. Polling every ${intervalStr}`);
  } catch (error) {
    console.error('Failed to bootstrap application:', error);
    process.exit(1);
  }
}

bootstrap();
