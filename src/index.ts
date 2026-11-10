import cron from 'node-cron';
import { TwitchClient } from './clients/twitch.client';
import { TwitchChatClient } from './clients/twitch_chat.client';
import { MattermostNotifier } from './services/mattermost.notifier';
import { DiscordNotifier } from './services/discord.notifier';
import { StateManager } from './services/state.manager';
import { InteractiveReceiver } from './services/interactive.receiver';
import { StreamerStateRepository } from './streamerStateRepository';
import { ApiServer } from './server';
import { AnnouncementAssembler } from './services/announcement.assembler';
import dotenv from 'dotenv';

dotenv.config();

class WashodoWardApp {
    async sendBroadcast(mattermostNotifier: MattermostNotifier, discordNotifier: DiscordNotifier, twitchChatClient: TwitchChatClient, stateRepo: StreamerStateRepository) {
        console.log(`[${new Date().toISOString()}] Running scheduled community broadcast...`);
        try {
            const announcements = await stateRepo.getAnnouncements();
            const assembled = await AnnouncementAssembler.assemble(announcements, 0); // streamerCount 0 for general broadcast

            if (!assembled.discord && !assembled.mattermost && !assembled.twitch) {
                console.log('No active announcements for any platform. Skipping broadcast.');
                return;
            }

            const notifications = [];

            if (assembled.mattermost) {
                // Use a generic 'System' or 'Community' identity for standalone broadcasts
                notifications.push(mattermostNotifier.notify({ user_name: 'Washodo Ward', user_login: 'washodo' }, false, assembled.mattermost));
            }
            if (assembled.discord) {
                notifications.push(discordNotifier.notify({ user_name: 'Washodo Ward', user_login: 'washodo' }, false, assembled.discord));
            }
            if (assembled.twitch) {
                // For Twitch, we can't send to a specific "global" channel easily without a target.
                // We might send it to the main hub channel if configured, or skip if no target is set.
                // For now, let's log that it would be sent to a hub channel.
                console.log(`[TwitchChatClient] Scheduled broadcast: ${assembled.twitch}`);
            }

            await Promise.allSettled(notifications);
            console.log('Scheduled community broadcast sent.');
        } catch (error) {
            console.error('Error during scheduled broadcast:', error);
        }
    }

    async runCheck(
        twitchClient: TwitchClient, 
        mattermostNotifier: MattermostNotifier, 
        discordNotifier: DiscordNotifier, 
        twitchChatClient: TwitchChatClient,
        stateManager: StateManager,
        stateRepo: StreamerStateRepository
    ) {
        console.log(`[${new Date().toISOString()}] Checking streamers...`);

        const entities = await stateRepo.getStreamers();
        const uniqueStreamers = [...new Set(entities.map((e: any) => e.username))];

        try {
            const liveStreams = await twitchClient.getStreamStatus(uniqueStreamers);
            const liveUsernames = liveStreams.map((s: any) => s.user_login);

            for (const username of uniqueStreamers) {
                const currentlyLive = liveUsernames.includes(username);
                const previouslyLive = await stateManager.isLive(username);

                if (currentlyLive) {
                    const streamData = liveStreams.find((s: any) => s.user_login === username);
                    const isRecurring = !!previouslyLive;
                    
                    // Assemble announcements from DB
                    const announcements = await stateRepo.getAnnouncements();
                    const assembled = await AnnouncementAssembler.assemble(announcements, liveUsernames.length);
                    
                    const notifications = [];
                    
                    if (assembled.mattermost) {
                        notifications.push(mattermostNotifier.notify(streamData, isRecurring, assembled.mattermost));
                    }
                    if (assembled.discord) {
                        notifications.push(discordNotifier.notify(streamData, isRecurring, assembled.discord));
                    }
                    if (assembled.twitch) {
                        notifications.push(twitchChatClient.sendMessage(username, assembled.twitch));
                    }

                    await Promise.allSettled(notifications);

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

    async bootstrap() {
        try {
            // Initialize State Repository first
            const stateRepo = new StreamerStateRepository();
            await stateRepo.init();

            // Initialize TwitchClient for use in both polling and interactive receiver
            const twitchClient = new TwitchClient({ 
                clientId: process.env.TWITCH_CLIENT_ID || '', 
                clientSecret: process.env.TWITCH_CLIENT_SECRET || '' 
            });

            // Initialize Notifiers
            const mattermostNotifier = new MattermostNotifier(stateRepo);
            const discordNotifier = new DiscordNotifier(stateRepo, twitchClient);
            const twitchChatClient = new TwitchChatClient(stateRepo, twitchClient);
            await discordNotifier.start();

            const stateManager = new StateManager();
            await stateManager.load();

            const receiver = new InteractiveReceiver(mattermostNotifier as any, twitchClient, stateRepo);

            // Start the API Server for the website and integrate the receiver's routes
            const apiServer = new ApiServer(stateRepo, receiver);
            apiServer.start();

            // Set up the cron job with the initialized services
            const intervalStr = process.env.CHECK_INTERVAL || '*/5 * * * *';
            cron.schedule(intervalStr, () => this.runCheck(twitchClient, mattermostNotifier, discordNotifier, twitchChatClient, stateManager, stateRepo));

            // Set up the community broadcast cron job
            const broadcastSettings = await stateRepo.getBroadcastSettings();
            if (broadcastSettings && broadcastSettings.is_enabled) {
                cron.schedule(broadcastSettings.cron_schedule, () => this.sendBroadcast(mattermostNotifier, discordNotifier, twitchChatClient, stateRepo));
                console.log(`Community Broadcast scheduled: ${broadcastSettings.cron_schedule}`);
            }

            // Run immediately on start
            await this.runCheck(twitchClient, mattermostNotifier, discordNotifier, twitchChatClient, stateManager, stateRepo);

            console.log(`Twitch Notifier started. Polling every ${intervalStr}`);
        } catch (error) {
            console.error('Failed to bootstrap application:', error);
            process.exit(1);
        }
    }
}

async function startApp() {
    const app = new WashodoWardApp();
    await app.bootstrap();
}

startApp();
