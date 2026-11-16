import axios from 'axios';
import { withRetry, LogThrottler } from '../utils/resilience';
import { getEnvPrefix } from '../utils/env';
import { DiscordConfig, DISCORD_COOLDOWNS } from './discord/types';
import { UmamiAnalytics } from './umami.service';

const BOT_RUNNER_URL = process.env.DISCORD_BOT_RUNNER_URL || 'http://localhost:3001';

export class DiscordNotifier {
    private configs: DiscordConfig[] = [];
    private stateRepo: any;
    private twitchClient: any;

    constructor(stateRepo: any, twitchClient?: any) {
        this.stateRepo = stateRepo;
        this.twitchClient = twitchClient;
        this.initializeConfigs().catch(err => console.error(`[DiscordNotifier] Initialization failed: ${err}`));
    }

    private async initializeConfigs(): Promise<void> {
        try {
            const integrations = await this.stateRepo.getDiscordIntegrations();
            if (integrations && integrations.length > 0) {
                this.configs = integrations.map((i: any) => ({
                    token: i.bot_token || process.env.DISCORD_BOT_TOKEN,
                    channelId: i.channel_id,
                    isActive: Boolean(i.is_active)
                })).filter((c: any) => c.token && c.channelId);

                if (this.configs.length > 0) {
                    return;
                }
            }
        } catch (err) {
            console.error(`[DiscordNotifier] Error loading configs from DB: ${err}`);
        }

        const discordEnv = process.env.DISCORD_BOTS || '';
        const configStrings = discordEnv.split(',').filter(Boolean);

        this.configs = configStrings.map(str => {
            const [token, channelId] = str.split('|');
            if (!token || !channelId) {
                console.warn(`[DiscordNotifier] Invalid server config found in env: ${str}`);
                return null;
            }
            return { token, channelId, isActive: true };
        }).filter((c): c is DiscordConfig => c !== null);
    }

    async syncConfigsFromDb(): Promise<void> {
        const integrations = await this.stateRepo.getDiscordIntegrations();
        if (!integrations || integrations.length === 0) return;

        const dbConfigs = integrations.map((i: any) => ({
            token: i.bot_token || process.env.DISCORD_BOT_TOKEN,
            channelId: i.channel_id,
            isActive: Boolean(i.is_active)
        })).filter((c: any) => c.token && c.channelId);

        const allConfigs = [...this.configs, ...dbConfigs];
        const seenChannels = new Set();

        this.configs = allConfigs.filter(c => {
            if (seenChannels.has(c.channelId)) return false;
            seenChannels.add(c.channelId);
            return true;
        });

        console.log(`[DiscordNotifier] Synced ${integrations.length} integrations from DB. Total unique configs: ${this.configs.length}`);
    }

    async start(): Promise<void> {
        await this.syncConfigsFromDb();
    }

    async handleCommand(message: any): Promise<void> {
        // Handled by Bot Runner
    }

    public async getClientForToken(token: string): Promise<any | null> {
        throw new Error('Direct client access is not available. Use the internal API.');
    }

    public async findOrCreateAnnouncementChannel(guildId: string): Promise<string> {
        try {
            const response = await axios.post(`${BOT_RUNNER_URL}/create-channel`, { guildId });
            return response.data.channelId;
        } catch (error: any) {
            console.error('[DiscordNotifier] Error in findOrCreateAnnouncementChannel:', error);
            throw error;
        }
    }

    public async createNotificationChannel(guildId: string): Promise<string> {
        return this.findOrCreateAnnouncementChannel(guildId);
    }

    async sendTestMessage(integration: any) {
        try {
            const response = await axios.post(`${BOT_RUNNER_URL}/send`, {
                token: integration.bot_token || process.env.DISCORD_BOT_TOKEN,
                channelId: integration.channel_id,
                embed: {
                    title: 'Test Message',
                    description: `${getEnvPrefix()}Test message from Washodo Ward Admin Panel!`,
                    color: 0x00FF00
                }
            });
            return response.data.success;
        } catch (error: any) {
            throw new Error(`Discord test failed: ${error.message}`);
        }
    }

    public async getGuildDetails(guildId: string, token: string): Promise<{ name: string, memberCount: number, icon: string | null }> {
        try {
            const response = await axios.get(`${BOT_RUNNER_URL}/guild/${guildId}`, {
                params: { token }
            });
            return response.data;
        } catch (error: any) {
            console.error(`[DiscordNotifier] Error fetching guild details for ${guildId}:`, error);
            throw error;
        }
    }

    public getInviteUrl(): string {
        const clientId = process.env.DISCORD_CLIENT_ID;
        if (!clientId) {
            throw new Error('DISCORD_CLIENT_ID not configured in environment');
        }
        return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    }

    async isRateLimited(): Promise<boolean> {
        const rateLimitUntil = await this.stateRepo.getGlobalState('discord_rate_limit_until');
        return !!(rateLimitUntil && parseInt(rateLimitUntil) > Date.now());
    }

    async getStatus() {
        try {
            const response = await axios.get(`${BOT_RUNNER_URL}/status`);
            const runnerStatus = response.data;

            const rateLimitUntil = await this.stateRepo.getGlobalState('discord_rate_limit_until');
            const lastPing = await this.stateRepo.getGlobalState('discord_rate_limit_last_ping');
            const retryAfter = await this.stateRepo.getGlobalState('discord_rate_limit_retry_after');
            const isRateLimited = rateLimitUntil && parseInt(rateLimitUntil) > Date.now();

            return {
                connected: runnerStatus.status === 'online',
                disabled: false,
                rateLimited: isRateLimited,
                rateLimitUntil: isRateLimited ? parseInt(rateLimitUntil) : null,
                lastPing: lastPing ? parseInt(lastPing) : null,
                retryAfter: retryAfter ? parseInt(retryAfter) : null,
                sessionStatus: 'Decoupled',
                lastError: null,
                lastFailureTime: null,
                botCount: runnerStatus.botCount,
                bots: runnerStatus.bots,
                activeChannels: this.configs.filter(c => c.isActive).length,
                totalConfigs: this.configs.length
            };
        } catch (error: any) {
            return {
                connected: false,
                disabled: false,
                rateLimited: false,
                botCount: 0,
                bots: [],
                activeChannels: this.configs.filter(c => c.isActive).length,
                totalConfigs: this.configs.length,
                lastError: `Bot Runner unreachable: ${error.message}`
            };
        }
    }

    async forceRetry(): Promise<void> {
        try {
            await axios.post(`${BOT_RUNNER_URL}/restart`);
        } catch (e) {
            console.error('[DiscordNotifier] Failed to trigger runner restart');
        }
    }

    async notify(streamer: any, isRecurring: boolean = false, scheduleText: string = ''): Promise<void> {
        if (this.configs.length === 0) {
            console.warn('[DiscordNotifier] No servers configured in database or DISCORD_BOTS');
            return;
        }

        const statusText = isRecurring ? 'is STILL LIVE!' : 'is now LIVE!';
        const thumbnail = streamer.thumbnail_url
            ? streamer.thumbnail_url.replace('{width}', '400').replace('{height}', '225')
            : '';

        for (const config of this.configs) {
            if (!config.isActive) {
                console.log(`[DiscordNotifier] Skipping inactive config for channel ${config.channelId}`);
                continue;
            }
            try {
                const cooldown = isRecurring
                    ? (parseInt(process.env.RECURRING_NOTIFICATION_MINUTES || '180'))
                    : 0;

                const shouldNotify = await this.stateRepo.shouldNotify(
                    streamer.user_login,
                    'discord',
                    config.channelId,
                    cooldown
                );

                    if (!shouldNotify) {
                        console.log(`[DiscordNotifier] Cooldown active for ${streamer.user_login} on channel ${config.channelId}; skipping.`);
                        continue;
                    }

                if (await this.isRateLimited()) {
                    console.warn(`[DiscordNotifier] Skipping notification for ${config.channelId} due to global rate limit.`);
                    continue;
                }

                await withRetry(
                    async () => {
                        await axios.post(`${BOT_RUNNER_URL}/send`, {
                            token: config.token,
                            channelId: config.channelId,
                            embed: {
                                color: 0xFF0000,
                                title: `${getEnvPrefix()}${streamer.user_name} ${statusText}`,
                                description: `**Title:** ${streamer.title || 'No title provided'}\\n**Link:** https://twitch.tv/${streamer.user_login}`,
                                thumbnail: thumbnail || null
                            }
                        });
                        console.log(`${getEnvPrefix()}[DiscordNotifier] Successfully sent notification for ${streamer.user_name} to channel ${config.channelId}`);
                        await UmamiAnalytics.trackEvent('Discord Notification Sent', { streamer: streamer.user_name, channelId: config.channelId });
                    },
                    3,
                    1000,
                    (err, attempt) => console.log(`[DiscordNotifier] Retry ${attempt} for ${config.channelId} due to: ${err.message}`)
                );

                await this.stateRepo.recordNotification(streamer.user_login, 'discord', config.channelId);

            } catch (error: any) {
                const isPermanentFailure =
                    error.message?.includes('not found') ||
                    error.code === 50001 ||
                    error.code === 10003;

                if (isPermanentFailure) {
                    console.error(`[DiscordNotifier] Permanent failure detected for channel ${config.channelId}. Marking as inactive.`);
                    await this.stateRepo.markDiscordIntegrationInactive(config.channelId);
                    this.configs = this.configs.filter(c => c.channelId !== config.channelId);
                }

                const logKey = `discord_error_${config.channelId}`;
                if (LogThrottler.shouldLog(logKey)) {
                    console.error(`[DiscordNotifier] Persistent failure for ${config.channelId}:`, error);
                }
            }
        }
    }

    async broadcast(text: string): Promise<void> {
        if (this.configs.length === 0) {
            console.warn('[DiscordNotifier] No servers configured for broadcast');
            return;
        }

        await this.syncConfigsFromDb();

        const activeConfigs = this.configs.filter(c => c.isActive);
        if (activeConfigs.length === 0) {
            console.warn('[DiscordNotifier] No active servers configured for broadcast');
            return;
        }

        for (const config of activeConfigs) {
            try {
                await withRetry(
                    async () => {
                        await axios.post(`${BOT_RUNNER_URL}/send`, {
                            token: config.token,
                            channelId: config.channelId,
                            embed: {
                                color: 0xa970ff,
                                title: `${getEnvPrefix()}📢 Community Announcement`,
                                description: text
                            }
                        });
                        console.log(`${getEnvPrefix()}[DiscordNotifier] Broadcast successfully sent to channel ${config.channelId}`);
                        await UmamiAnalytics.trackEvent('Discord Broadcast Sent', { channelId: config.channelId });
                    },
                    3,
                    1000,
                    (err, attempt) => console.log(`[DiscordNotifier] Broadcast retry ${attempt} for ${config.channelId}: ${err.message}`)
                );
            } catch (error: any) {
                console.error(`[DiscordNotifier] Broadcast failed for ${config.channelId}:`, error);
            }
        }
    }

    async getActiveTargets() {
        await this.syncConfigsFromDb();
        const targets = [];
        for (const config of this.configs) {
            if (config.isActive) {
                try {
                    const response = await axios.get(`${BOT_RUNNER_URL}/channel/${config.channelId}`, {
                        params: { token: config.token }
                    });
                    targets.push({
                        ...response.data,
                        channelId: config.channelId
                    });
                } catch (e) {
                    console.error(`[DiscordNotifier] Error in getActiveTargets for ${config.channelId}:`, e);
                    targets.push({
                        guildName: 'Error',
                        channelName: 'Error',
                        channelId: config.channelId
                    });
                }
            }
        }
        return targets;
    }
}
