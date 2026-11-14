import { Client, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { withRetry, LogThrottler } from '../utils/resilience';
import { getEnvPrefix } from '../utils/env';
import { DiscordConfig, DISCORD_COOLDOWNS } from './discord/types';
import { DiscordSessionManager } from './discord/session.manager';
import { DiscordCommandHandler } from './discord/command.handler';

export class DiscordNotifier {
    private configs: DiscordConfig[] = [];
    private stateRepo: any;
    private twitchClient: any;
    private sessionManager: DiscordSessionManager;
    private commandHandler: DiscordCommandHandler;

    constructor(stateRepo: any, twitchClient?: any) {
        this.stateRepo = stateRepo;
        this.twitchClient = twitchClient;
        this.sessionManager = new DiscordSessionManager(stateRepo);
        this.commandHandler = new DiscordCommandHandler(stateRepo, twitchClient);
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
        await this.sessionManager.start(this.configs);
    }

    // Delegate command handling to the CommandHandler
    async handleCommand(message: any): Promise<void> {
        await this.commandHandler.handleCommand(message);
    }

    public async getClientForToken(token: string): Promise<any | null> {
        return this.sessionManager.clients.get(token) || null;
    }

    public async findOrCreateAnnouncementChannel(guildId: string): Promise<string> {
        const firstToken = this.sessionManager.clients.keys().next().value;
        if (!firstToken) throw new Error('No Discord managers are logged in. Cannot manage channels.');
        const manager = this.sessionManager.clients.get(firstToken);

        try {
            return await manager.broadcastEval(async (ctx: any) => {
                const client = ctx.client || ctx;
                if (!client || !client.guilds) {
                    throw new Error('Discord client or guilds manager not available in shard context');
                }
                const guild = await client.guilds.fetch(ctx.guildId);
                if (!guild) throw new Error(`Guild ${ctx.guildId} not found`);

                const channels = await guild.channels.fetch();
                const existingAnnouncement = channels.find((c: any) => c?.name === '📯-ward-bot' && (c?.type === 0 || c?.type === 5));

                if (existingAnnouncement) {
                    console.log(`[DiscordBot] Found existing announcement channel ${existingAnnouncement.id} for guild ${ctx.guildId}`);
                    return existingAnnouncement.id;
                }

                console.log(`[DiscordBot] No announcement channel found for guild ${ctx.guildId}. Creating one...`);
                let channel;
                try {
                    channel = await guild.channels.create({
                        name: '📯-ward-bot',
                        type: 5,
                        topic: 'Official Twitch notifications for the Washodo community.',
                    });
                } catch (announcementError: any) {
                    if (announcementError.code === 50035 || announcementError.message?.includes('Invalid Form Body')) {
                        console.log(`[DiscordBot] Community features not enabled for guild ${ctx.guildId}. Falling back to GuildText...`);
                        channel = await guild.channels.create({
                            name: '📯-ward-bot',
                            type: 0,
                            topic: 'Official Twitch notifications for the Washodo community.',
                        });
                    } else {
                        throw announcementError;
                    }
                }

                if (!channel) throw new Error('Failed to create announcement channel');
                return channel.id;
            }, { guildId });
        } catch (error: any) {
            console.error('[DiscordNotifier] Error in findOrCreateAnnouncementChannel:', error);
            throw error;
        }
    }

    public async createNotificationChannel(guildId: string): Promise<string> {
        return this.findOrCreateAnnouncementChannel(guildId);
    }

    async sendTestMessage(integration: any) {
        const manager = this.sessionManager.clients.get(integration.bot_token || process.env.DISCORD_BOT_TOKEN);
        if (!manager) throw new Error('Discord manager for this token is not active.');

        try {
            await manager.broadcastEval(async (ctx: any) => {
                const client = ctx.client || ctx;
                if (!client || !client.guilds) {
                    throw new Error('Discord client or guilds manager not available in shard context');
                    }
                const guild = await client.guilds.fetch(ctx.guildId);
                if (!guild) throw new Error(`Guild ${ctx.guildId} not found`);

                const channel = await guild.channels.fetch(ctx.channelId);
                if (!channel || (!(channel as any).isTextBased())) {
                    throw new Error('Notification channel not found or is not a valid text/announcement channel');
                }

                const env = process.env.APP_ENV;
                const prefix = (env && env !== 'production') ? `[${env.toUpperCase()}] ` : '';

                await (channel as any).send(`${prefix}Test message from Washodo Ward Admin Panel!`);
            }, { guildId: integration.guild_id, channelId: integration.channel_id });
            return true;
        } catch (error: any) {
            throw new Error(`Discord test failed: ${error.message}`);
        }
    }

    public async getGuildDetails(guildId: string, token: string): Promise<{ name: string, memberCount: number, icon: string | null }> {
        const manager = this.sessionManager.clients.get(token);
        if (!manager) {
            throw new Error('Discord manager for this token is not active.');
        }
        try {
            return await manager.broadcastEval(async (ctx: any) => {
                const client = ctx.client || ctx;
                if (!client || !client.guilds) {
                    throw new Error('Discord client or guilds manager not available in shard context');
                }
                const guild = await client.guilds.fetch(ctx.guildId);
                return {
                    name: guild.name,
                    memberCount: guild.memberCount,
                    icon: typeof guild.iconURL === 'function' ? guild.iconURL() : guild.iconURL
                };
            }, { guildId });
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
        const rateLimitUntil = await this.stateRepo.getGlobalState('discord_rate_limit_until');
        const lastPing = await this.stateRepo.getGlobalState('discord_rate_limit_last_ping');
        const retryAfter = await this.stateRepo.getGlobalState('discord_rate_limit_retry_after');
        const isRateLimited = rateLimitUntil && parseInt(rateLimitUntil) > Date.now();

        let overallSessionStatus = 'Fresh';
        if (this.sessionManager.clients.size > 0) {
            const firstToken = this.sessionManager.clients.keys().next().value;
            if (firstToken) {
                overallSessionStatus = this.sessionManager.sessionSources.get(firstToken) || 'Fresh';
            }
        }

        const connected = this.sessionManager.clients.size > 0 && !this.sessionManager.isDisabled && !isRateLimited;

        const botDetails = await Promise.all(
            Array.from(this.sessionManager.clients.entries()).map(async ([token, manager]) => {
                try {
                    const results = await manager.broadcastEval(async (ctx: any) => {
                        const client = ctx.client || ctx;
                        return {
                            tag: client.user?.tag || 'Unknown Bot',
                            id: client.user?.id || 'Unknown ID',
                            avatar: client.user?.displayAvatarURL ? client.user.displayAvatarURL() : null,
                            status: client.user?.presence?.status || 'offline'
                        };
                    });
                    return results[0];
                } catch (e) {
                    return {
                        tag: 'Error',
                        id: 'Error',
                        avatar: null,
                        status: 'offline'
                    };
                }
            })
        );

        return {
            connected,
            disabled: this.sessionManager.isDisabled,
            rateLimited: isRateLimited,
            rateLimitUntil: isRateLimited ? parseInt(rateLimitUntil) : null,
            lastPing: lastPing ? parseInt(lastPing) : null,
            retryAfter: retryAfter ? parseInt(retryAfter) : null,
            sessionStatus: overallSessionStatus,
            lastError: this.sessionManager.lastFailureError,
            lastFailureTime: this.sessionManager.lastFailureTime,
            botCount: this.sessionManager.clients.size,
            bots: botDetails,
            activeChannels: this.configs.filter(c => c.isActive).length,
            totalConfigs: this.configs.length
        };
    }

    async forceRetry(): Promise<void> {
        await this.stateRepo.clearDiscordRateLimit();
        await this.stateRepo.setGlobalState('discord_session_token', '0');
        await this.sessionManager.resetFailureState();
        await this.start();
    }

    async notify(streamer: any, isRecurring: boolean = false, scheduleText: string = ''): Promise<void> {
        if (this.sessionManager.isDisabled) {
            const now = Date.now();
            const cooldown = Math.min(
                DISCORD_COOLDOWNS.MIN * Math.pow(2, this.sessionManager.failureCount - 1),
                DISCORD_COOLDOWNS.MAX
            );
            if (now - this.sessionManager.lastFailureTime < cooldown) {
                return;
            }
            // We don't reset here because sessionManager.start() handles it
        }

        if (this.configs.length === 0) {
            console.warn('[DiscordNotifier] No servers configured in database or DISCORD_BOTS');
            return;
        }

        const statusText = isRecurring ? 'is STILL LIVE!' : 'is now LIVE!';
        const thumbnail = streamer.thumbnail_url
            ? streamer.thumbnail_url.replace('{width}', '400').replace('{height}', '225')
            : '';

        for (const config of this.configs) {
            if (!config.isActive) continue;
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

                if (!shouldNotify) continue;

                const manager = this.sessionManager.clients.get(config.token);
                if (!manager) continue;

                if (await this.isRateLimited()) {
                    console.warn(`[DiscordNotifier] Skipping notification for ${config.channelId} due to global rate limit.`);
                    continue;
                }

                await withRetry(
                    async () => {
                        await manager.broadcastEval(async (ctx: any) => {
                            const client = ctx.client;
                            const channel = await client.channels.fetch(config.channelId);
                            if (!channel || !channel.isTextBased()) {
                                throw new Error(`Channel ${config.channelId} not found or not text-based`);
                            }

                            const embed = new (require('discord.js').EmbedBuilder)()
                                .setColor(0xFF0000)
                                .setTitle(`${getEnvPrefix()}${streamer.user_name} ${statusText}`)
                                .setDescription(`**Title:** ${streamer.title || 'No title provided'}\\n**Link:** https://twitch.tv/${streamer.user_login}`)
                                .setThumbnail(thumbnail || null)
                                .setTimestamp();

                            await channel.send({ embeds: [embed] });
                        });
                        console.log(`${getEnvPrefix()}[DiscordNotifier] Successfully sent notification for ${streamer.user_name} to channel ${config.channelId}`);
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
        if (this.sessionManager.isDisabled) {
            const now = Date.now();
            const cooldown = Math.min(
                DISCORD_COOLDOWNS.MIN * Math.pow(2, this.sessionManager.failureCount - 1),
                DISCORD_COOLDOWNS.MAX
            );
            if (now - this.sessionManager.lastFailureTime < cooldown) {
                console.warn(`[DiscordNotifier] Broadcast skipped: Service is in cooldown due to login failures.`);
                return;
            }
        }

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
                const manager = this.sessionManager.clients.get(config.token);
                if (!manager) {
                    console.error(`[DiscordNotifier] No manager found for token used in channel ${config.channelId}.`);
                    continue;
                }

                await withRetry(
                    async () => {
                        await manager.broadcastEval(async (ctx: any) => {
                            const client = ctx.client;
                            const channel = await client.channels.fetch(config.channelId);
                            if (!channel || !channel.isTextBased()) {
                                throw new Error(`Channel ${config.channelId} not found or not text-based`);
                            }

                            const embed = new (require('discord.js').EmbedBuilder)()
                                .setColor(0xa970ff)
                                .setTitle(`${getEnvPrefix()}📢 Community Announcement`)
                                .setDescription(text)
                                .setTimestamp();

                            await channel.send({ embeds: [embed] });
                        });
                        console.log(`${getEnvPrefix()}[DiscordNotifier] Broadcast successfully sent to channel ${config.channelId}`);
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
                const manager = this.sessionManager.clients.get(config.token);
                if (manager) {
                    try {
                        const details = await manager.broadcastEval(async (ctx: any) => {
                            const client = ctx.client || ctx;
                            if (!client || !client.guilds) {
                                throw new Error('Discord client or guilds manager not available in shard context');
                            }
                            const channel = await client.channels.fetch(config.channelId);
                            
                            // Diagnostic logging to identify why guildName is missing
                            console.log(`[DiscordBot] broadcastEval Guild Name Check for ${config.channelId}:`, {
                                channelFound: !!channel,
                                guildFound: !!channel?.guild,
                                guildName: channel?.guild?.name
                            });

                            return {
                                guildName: channel?.guild?.name || 'Unknown Guild',
                                channelName: channel?.name || 'Unknown Channel'
                            };
                        });
                        targets.push({
                            ...details,
                            channelId: config.channelId
                        });
                    } catch (e) {
                        console.error(`[DiscordNotifier] Error in getActiveTargets broadcastEval for ${config.channelId}:`, e);
                        targets.push({
                            guildName: 'Error',
                            channelName: 'Error',
                            channelId: config.channelId
                        });
                    }
                }
            }
        }
        return targets;
    }
}
