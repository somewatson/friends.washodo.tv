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
    private stateRepo!: StreamerStateRepository;
    private broadcastJobs: Map<number, any> = new Map();

    async triggerForcedBroadcast(mattermostNotifier: MattermostNotifier, discordNotifier: DiscordNotifier, twitchChatClient: TwitchChatClient) {
        console.log(`[${new Date().toISOString()}] Manual trigger: Running forced community broadcast...`);
        try {
            const announcements = await this.stateRepo.getAnnouncements();
            const activeAnnouncements = announcements.filter(a => a.is_active);
            
            for (const ann of activeAnnouncements) {
                await this.executeBroadcast(ann, mattermostNotifier, discordNotifier, twitchChatClient);
            }
            console.log('Forced community broadcast completed.');
        } catch (error) {
            console.error('Error during forced broadcast:', error);
            throw error;
        }
    }

    private async executeBroadcast(ann: any, mattermostNotifier: MattermostNotifier, discordNotifier: DiscordNotifier, twitchChatClient: TwitchChatClient) {
        try {
            const assembled = await AnnouncementAssembler.assemble([ann], 0);
            if (!assembled.discord && !assembled.mattermost && !assembled.twitch) return;

            const notifications = [];
            if (assembled.mattermost && ann.mattermost_enabled) {
                notifications.push(mattermostNotifier.broadcast(assembled.mattermost));
            }
            if (assembled.discord && ann.discord_enabled) {
                notifications.push(discordNotifier.broadcast(assembled.discord));
            }
            if (assembled.twitch && ann.twitch_enabled) {
                console.log(`[TwitchChatClient] Broadcast: ${assembled.twitch}`);
            }
            await Promise.allSettled(notifications);
        } catch (error) {
            console.error(`[Broadcast] Error executing announcement ${ann.id}:`, error);
        }
    }

    async scheduleBroadcasts(mattermostNotifier: MattermostNotifier, discordNotifier: DiscordNotifier, twitchChatClient: TwitchChatClient) {
        console.log(`[${new Date().toISOString()}] Scheduling community broadcasts...`);
        try {
            const announcements = await this.stateRepo.getAnnouncements();
            
            for (const job of this.broadcastJobs.values()) {
                job.stop();
            }
            this.broadcastJobs.clear();

            for (const ann of announcements) {
                // Ensure we check both is_active AND that at least one platform is enabled
                const hasTarget = ann.discord_enabled || ann.mattermost_enabled || ann.twitch_enabled;
                if (!ann.is_active || !ann.cron_schedule || !hasTarget) continue;

                    try {
                        const job = cron.schedule(ann.cron_schedule, () => {
                            console.log(`[Broadcast] Scheduled trigger for announcement ${ann.id}: ${ann.cron_schedule}`);
                            this.executeBroadcast(ann, mattermostNotifier, discordNotifier, twitchChatClient);
                        });
                        this.broadcastJobs.set(ann.id, job);
                        
                        const nextDate = (parser as any).parseExpression(ann.cron_schedule).next().toDate();
                        const diffMs = nextDate.getTime() - Date.now();
                        const diffHrs = Math.floor(diffMs / 3600000);
                        const diffMins = Math.floor((diffMs % 3600000) / 60000);
                        const relativeTime = diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins}m`;

                        const textSnippet = ann.text.substring(0, 30).replace(/\n/g, ' ') + (ann.text.length > 30 ? '...' : '');
                        console.log(`[Broadcast] Successfully scheduled announcement ${ann.id} ("${textSnippet}") with schedule: ${ann.cron_schedule} (next event in ${relativeTime})`);
                    } catch (err) {
                    console.error(`[Broadcast] Invalid cron expression for announcement ${ann.id}: ${ann.cron_schedule}`);
                }
            }
            console.log(`Scheduled ${this.broadcastJobs.size} active community broadcasts.`);
        } catch (error) {
            console.error('Error scheduling broadcasts:', error);
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
                    
                    // For "Live" notifications, we check if ANY announcement is enabled for the platform
                    // because the assembler already filters for is_active and date range.
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

            // Start Discord in the background so it doesn't block Mattermost/Twitch bootstrap
            discordNotifier.start().catch(err => {
                console.error(`[Bootstrap] Discord startup encountered a critical error: ${err.message}`);
                console.log('Continuing bootstrap for other services...');
            });

            const stateManager = new StateManager();
            await stateManager.load();

            const receiver = new InteractiveReceiver(mattermostNotifier as any, twitchClient, stateRepo);

            // Start the API Server for the website and integrate the receiver's routes
            const apiServer = new ApiServer(stateRepo, receiver, this);
            apiServer.start();

            // Set up the cron job with the initialized services
            const intervalStr = process.env.CHECK_INTERVAL || '*/5 * * * *';
            cron.schedule(intervalStr, () => this.runCheck(twitchClient, mattermostNotifier, discordNotifier, twitchChatClient, stateManager, stateRepo));

            // Schedule broadcasts once on bootstrap
            await this.scheduleBroadcasts(mattermostNotifier, discordNotifier, twitchChatClient);

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
