import cron from 'node-cron';
import cronParser from 'cron-parser';
// @ts-ignore
const parser = cronParser;
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
    private stateRepo!: StreamerStateRepository; // Added to make it accessible to methods

    async triggerForcedBroadcast(mattermostNotifier: MattermostNotifier, discordNotifier: DiscordNotifier, twitchChatClient: TwitchChatClient) {
        console.log(`[${new Date().toISOString()}] Manual trigger: Running forced community broadcast...`);
        try {
            const announcements = await this.stateRepo.getAnnouncements();
            const activeAnnouncements = announcements.filter(a => a.is_active);
            
            for (const ann of activeAnnouncements) {
                const assembled = await AnnouncementAssembler.assemble([ann], 0);
                if (!assembled.discord && !assembled.mattermost && !assembled.twitch) continue;
                
                const notifications = [];
                if (assembled.mattermost && ann.mattermost_enabled) {
                    notifications.push(mattermostNotifier.broadcast(assembled.mattermost));
                }
                if (assembled.discord && ann.discord_enabled) {
                    notifications.push(discordNotifier.broadcast(assembled.discord));
                }
                if (assembled.twitch && ann.twitch_enabled) {
                    console.log(`[TwitchChatClient] Forced broadcast: ${assembled.twitch}`);
                }
                await Promise.allSettled(notifications);
            }
            console.log('Forced community broadcast completed.');
        } catch (error) {
            console.error('Error during forced broadcast:', error);
            throw error;
        }
    }

    async sendBroadcast(mattermostNotifier: MattermostNotifier, discordNotifier: DiscordNotifier, twitchChatClient: TwitchChatClient, stateRepo: StreamerStateRepository) {
        this.stateRepo = stateRepo; // Ensure it's set
        console.log(`[${new Date().toISOString()}] Running community broadcast check...`);
        try {
            const announcements = await stateRepo.getAnnouncements();
            const now = new Date();
            
            for (const ann of announcements) {
                if (!ann.is_active) continue;
                if (!ann.cron_schedule) continue;

                try {
                    const interval = (cronParser as any).parseExpression(ann.cron_schedule);
                    const nextDate = interval.next().toDate();
                    if (Math.abs(nextDate.getTime() - now.getTime()) < 60000) {
                        console.log(`[Broadcast] Schedule match for announcement ${ann.id}: ${ann.cron_schedule}`);
                        
                        const assembled = await AnnouncementAssembler.assemble([ann], 0);
                        
                        if (!assembled.discord && !assembled.mattermost && !assembled.twitch) continue;
        
                        const notifications = [];
                        if (assembled.mattermost && ann.mattermost_enabled) {
                            notifications.push(mattermostNotifier.broadcast(assembled.mattermost));
                        }
                        if (assembled.discord && ann.discord_enabled) {
                            notifications.push(discordNotifier.broadcast(assembled.discord));
                        }
                        if (assembled.twitch && ann.twitch_enabled) {
                            console.log(`[TwitchChatClient] Scheduled broadcast: ${assembled.twitch}`);
                        }
                        await Promise.allSettled(notifications);
                    }
                } catch (err) {
                    console.error(`[Broadcast] Invalid cron expression for announcement ${ann.id}: ${ann.cron_schedule}`);
                }
            }
            console.log('Community broadcast check completed.');
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

            for (const entity of entities) {
                const username = entity.username;
                const currentlyLive = liveUsernames.includes(username);
                const previouslyLive = await stateManager.isLive(username);

                if (currentlyLive && entity.notify_enabled) {
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
            this.stateRepo = stateRepo;

            // Initialize TwitchClient for use in both polling and interactive receiver
            const twitchClient = new TwitchClient({ 
                clientId: process.env.TWITCH_CLIENT_ID || '', 
                clientSecret: process.env.TWITCH_CLIENT_SECRET || '' 
            });

            // Initialize Notifiers
            const mattermostNotifier = new MattermostNotifier(stateRepo);
            const discordNotifier = new DiscordNotifier(stateRepo, twitchClient);
            const twitchChatClient = new TwitchChatClient(stateRepo, twitchClient);
            
            // Store them for the API server/forced broadcast
            (this as any).mattermostNotifier = mattermostNotifier;
            (this as any).discordNotifier = discordNotifier;
            (this as any).twitchChatClient = twitchChatClient;

            await discordNotifier.start();

            const stateManager = new StateManager();
            await stateManager.load();

            const receiver = new InteractiveReceiver(mattermostNotifier as any, twitchClient, stateRepo);

            // Start the API Server for the website and integrate the receiver's routes
            const apiServer = new ApiServer(stateRepo, receiver, this);
            apiServer.start();

            // Set up the cron job with the initialized services
            const intervalStr = process.env.CHECK_INTERVAL || '*/5 * * * *';
            cron.schedule(intervalStr, () => this.runCheck(twitchClient, mattermostNotifier, discordNotifier, twitchChatClient, stateManager, stateRepo));

            // Set up the community broadcast cron job to run every minute
            // This will check each announcement's individual schedule
            cron.schedule('* * * * *', () => this.sendBroadcast(mattermostNotifier, discordNotifier, twitchChatClient, stateRepo));
            console.log('Community Broadcast checker scheduled to run every minute');

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
