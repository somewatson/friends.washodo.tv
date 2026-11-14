import { Client, GatewayIntentBits, EmbedBuilder, ShardingManager } from 'discord.js';
import axios from 'axios';
import { withRetry, LogThrottler } from '../utils/resilience';
import { getEnvPrefix } from '../utils/env';

interface DiscordConfig {
    token: string;
    channelId: string;
    isActive: boolean;
}

export class DiscordNotifier {
    public clients: Map<string, any> = new Map();
    private sessionSources: Map<string, 'Cached' | 'Fresh'> = new Map();
    private configs: DiscordConfig[] = [];
    private stateRepo: any; // Will be StreamerStateRepository
    private twitchClient: any; // Will be TwitchClient
    private isDisabledDueToFailure = false;
    private lastFailureTime = 0;
    private failureCount = 0;
    private readonly MIN_COOLDOWN = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_COOLDOWN = 60 * 60 * 1000; // 1 hour

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
            return { token, channelId };
        }).filter((c): c is DiscordConfig => c !== null);
    }

    async syncConfigsFromDb(): Promise<void> {
        const integrations = await this.stateRepo.getDiscordIntegrations();
        if (integrations.length === 0) return;

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

    private lastFailureError: string = '';

    async start(): Promise<void> {
        await this.syncConfigsFromDb();

        const env = getEnvPrefix();
        if (this.isDisabledDueToFailure) {
            const now = Date.now();
            const cooldown = Math.min(
                this.MIN_COOLDOWN * Math.pow(2, this.failureCount - 1),
                this.MAX_COOLDOWN
            );
            if (now - this.lastFailureTime < cooldown) {
                console.warn(`${env}[DiscordNotifier] Service is in cooldown due to ${this.failureCount} previous failures. Skipping login attempts until ${new Date(this.lastFailureTime + cooldown).toISOString()}. (Next interval: ${Math.round(cooldown / 60000)}m)`);
                return;
            }
            console.log(`${env}[DiscordNotifier] Cooldown period expired. Attempting login...`);
            this.isDisabledDueToFailure = false;
        }

        console.log(`${env}[DiscordNotifier] Starting Discord bots via ShardingManager...`);
        
        for (const config of this.configs) {
            if (this.clients.has(config.token)) continue;

            try {
                // We spawn a dedicated ShardingManager for each bot token.
                // In a large scale app, we'd have one manager for all, but since these
                // are different bot tokens, they each need their own manager instance.
                const manager = new ShardingManager(process.cwd() + '/dist/bot.js', {
                    token: config.token,
                    totalShards: 1
                });

                manager.on('shardCreate', shard => {
                    console.log(`${env}[DiscordNotifier] Shard ${shard.id} created for bot ...${config.token.slice(-4)}`);
                });

                (manager as any).on('error', (err: any) => {
                    console.error(`${env}[DiscordNotifier] Manager error for bot ...${config.token.slice(-4)}: ${err}`);
                });

                await manager.spawn();
                
                // We track the manager instead of the client because the client lives in the child process.
                this.clients.set(config.token, manager as any); 
                this.isDisabledDueToFailure = false;
                this.failureCount = 0;

            } catch (error: any) {
                console.error(`${env}[DiscordNotifier] Failed to spawn bot for channel ${config.channelId}: ${error.message}`);
                this.isDisabledDueToFailure = true;
                this.failureCount++;
                this.lastFailureTime = Date.now();
            }
        }
        
        console.log(`${env}[DiscordNotifier] Discord sharding phase completed.`);
    }

    private async handleCommand(message: any): Promise<void> {
        const text = message.content.trim();
        if (!text) return;

        const parts = text.split(/\s+/);
        const lowerParts = parts.map((p: string) => p.toLowerCase());

        const commandKeywords = ['help', 'status', 'streamers', 'check', 'schedule', 'setup'];
        const hasTrigger = parts.some((p: string) => p.startsWith('!') || p.startsWith('@'));
        if (!hasTrigger) return;

        let commandIndex = -1;
        let matchedKeyword = '';

        for (let i = 0; i < lowerParts.length; i++) {
            const word = lowerParts[i];
            if (!word) continue;
            const cleanWord = word.startsWith('!') ? word.slice(1) : word;
            if (commandKeywords.includes(cleanWord)) {
                commandIndex = i;
                matchedKeyword = cleanWord;
                break;
            }
        }

        if (commandIndex === -1) {
            const botUser = message.client.user;
            const isBotMentioned = message.mentions.users.has(botUser.id);

            if (isBotMentioned && (parts[0]?.startsWith('!') || parts[0]?.startsWith('@'))) {
                await message.reply(`I heard you mention me, but I don't recognize a command. Try \`!help\`.`);
            }
            return;
        }

        const command = `!${matchedKeyword}`;
        const args = parts.slice(commandIndex + 1);

        if (command === '!help') {
            await message.reply('🤖 **Bot Help Menu**\n- `!status`: Check current monitoring status\n- `!streamers`: Show all tracked streamers and their status\n- `!check <username>`: Check a specific streamer\n- `!schedule`: View the current stream schedule\n- `!setup`: Automatically create the announcement channel\n- `!help`: Show this menu');
        } else if (command === '!status') {
            await message.reply('✅ Bot is active and monitoring streamers!');
        } else if (command === '!schedule') {
            const setting = await this.stateRepo.getBotSetting('schedule_text');
            const schedule = setting?.value || 'No schedule configured.';
            await message.reply(`📅 **Current Schedule**\n${schedule}`);
        } else if (command === '!streamers') {
            await this.handleListStreamers(message);
        } else if (command === '!check') {
            if (args.length === 0) {
                await message.reply('❌ Please provide a username. Usage: `!check <username>`');
                return;
            }
            await this.handleCheckStreamer(args[0], message);
        } else if (command === '!setup') {
            await this.handleSetup(message);
        }
    }

    private async handleSetup(message: any): Promise<void> {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command can only be used in a server.');
                return;
            }

            await message.reply('⚙️ Setting up the announcement channel...');

            const channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: 0, 
                topic: 'Official Twitch notifications for the Washodo community.',
            });

            await this.stateRepo.saveDiscordIntegration(
                guild.id, 
                channel.id, 
                message.author.id
            );

            await this.syncConfigsFromDb();

            await channel.send(`✅ **Channel created!** I will now post notifications in this channel. \nManaged by: <@${message.author.id}>`);
            await message.reply(`✅ Success! I've created the channel <#${channel.id}>.`);

        } catch (error) {
            console.error('[DiscordNotifier] Setup error:', error);
            await message.reply('❌ Failed to create the announcement channel. Please ensure I have the `Manage Channels` permission.');
        }
    }

    private async handleListStreamers(message: any): Promise<void> {
        if (!this.twitchClient) {
            await message.reply('❌ Twitch client not initialized.');
            return;
        }

        const members = await this.stateRepo.getStreamerUsernamesByCategory('member');
        const friends = await this.stateRepo.getStreamerUsernamesByCategory('friend');
        const others = (process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean);
        const allStreamers = [...new Set([...members, ...friends, ...others])];

        if (allStreamers.length === 0) {
            await message.reply('No streamers are currently being tracked.');
            return;
        }

        try {
            const liveStreams = await this.twitchClient.getStreamStatus(allStreamers);
            const liveUsernames = liveStreams.map((s: any) => s.user_login.toLowerCase());
            
            let response = '👥 **Tracked Streamers**\n';
            const formatGroup = (title: string, list: string[]) => {
                if (list.length === 0) return '';
                let groupText = `\n**${title}**\n`;
                list.forEach(user => {
                    const isLive = liveUsernames.includes(user.toLowerCase());
                    groupText += `- ${user}: ${isLive ? '🔴 Live' : '⚪ Offline'}\n`;
                });
                return groupText;
            };

            response += formatGroup('Members', members);
            response += formatGroup('Friends', friends);
            response += formatGroup('Other', others);

            await message.reply(response.trim());
        } catch (error) {
            console.error('[DiscordNotifier] Error listing streamers:', error);
            await message.reply('❌ Error fetching streamer statuses.');
        }
    }

    private async handleCheckStreamer(username: string, message: any): Promise<void> {
        if (!this.twitchClient) {
            await message.reply('❌ Twitch client not initialized.');
            return;
        }

        try {
            const liveStreams = await this.twitchClient.getStreamStatus([username]);
            const stream = liveStreams[0];

            if (stream) {
                await message.reply(`🔴 **${stream.user_name}** is currently LIVE!\nTitle: ${stream.title || 'No title provided'}\nLink: https://twitch.tv/${stream.user_login}`);
            } else {
                await message.reply(`⚪ **${username}** is currently offline.`);
            }
        } catch (error) {
            console.error('[DiscordNotifier] Error checking streamer:', error);
            await message.reply(`❌ Error checking status for ${username}.`);
        }
    }

    public async getClientForToken(token: string): Promise<any | null> {
        return this.clients.get(token) || null;
    }

    public async findOrCreateAnnouncementChannel(guildId: string): Promise<string> {
        const firstToken = this.clients.keys().next().value;
        if (!firstToken) throw new Error('No Discord managers are logged in. Cannot manage channels.');
        const manager = this.clients.get(firstToken);
        
        try {
            return await manager.broadcastEval(async (ctx: any) => {
                const client = ctx.client;
                const guild = await client.guilds.fetch(guildId);
                if (!guild) throw new Error(`Guild ${guildId} not found`);
        
                const channels = await guild.channels.fetch();
                const existingAnnouncement = channels.find((c: any) => c?.name === '📯-ward-bot' && (c?.type === 0 || c?.type === 5));
                
                if (existingAnnouncement) {
                    console.log(`[DiscordBot] Found existing announcement channel ${existingAnnouncement.id} for guild ${guildId}`);
                    return existingAnnouncement.id;
                }
        
                console.log(`[DiscordBot] No announcement channel found for guild ${guildId}. Creating one...`);
                let channel;
                try {
                    channel = await guild.channels.create({
                        name: '📯-ward-bot',
                        type: 5,
                        topic: 'Official Twitch notifications for the Washodo community.',
                    });
                } catch (announcementError: any) {
                    if (announcementError.code === 50035 || announcementError.message?.includes('Invalid Form Body')) {
                        console.log(`[DiscordBot] Community features not enabled for guild ${guildId}. Falling back to GuildText...`);
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
            });
        } catch (error: any) {
            console.error('[DiscordNotifier] Error in findOrCreateAnnouncementChannel:', error);
            throw error;
        }
    }

    public async createNotificationChannel(guildId: string): Promise<string> {
        return this.findOrCreateAnnouncementChannel(guildId);
    }

    async sendTestMessage(integration: any) {
        const manager = this.clients.get(integration.bot_token || process.env.DISCORD_BOT_TOKEN);
        if (!manager) throw new Error('Discord manager for this token is not active.');
        
        try {
            await manager.broadcastEval(async (ctx: any) => {
                const client = ctx.client;
                const guild = await client.guilds.fetch(integration.guild_id);
                if (!guild) throw new Error(`Guild ${integration.guild_id} not found`);
                
                const channel = await guild.channels.fetch(integration.channel_id);
                if (!channel || (!(channel as any).isTextBased())) {
                    throw new Error('Notification channel not found or is not a valid text/announcement channel');
                }
                
                const env = process.env.APP_ENV;
                const prefix = (env && env !== 'production') ? `[${env.toUpperCase()}] ` : '';
                
                await (channel as any).send(`${prefix}Test message from Washodo Ward Admin Panel!`);
            });
            return true;
        } catch (error: any) {
            throw new Error(`Discord test failed: ${error.message}`);
        }
    }

    public async getGuildDetails(guildId: string, token: string): Promise<{ name: string, memberCount: number, icon: string | null }> {
        const manager = this.clients.get(token);
        if (!manager) {
            throw new Error('Discord manager for this token is not active.');
        }
        try {
            return await manager.broadcastEval(async (ctx: any) => {
                const client = ctx.client;
                const guild = await client.guilds.fetch(guildId);
                return {
                    name: guild.name,
                    memberCount: guild.memberCount,
                    icon: guild.iconURL()
                };
            });
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
        if (this.clients.size > 0) {
            const firstToken = this.clients.keys().next().value;
            if (firstToken) {
                overallSessionStatus = this.sessionSources.get(firstToken) || 'Fresh';
            }
        }

        const connected = this.clients.size > 0 && !this.isDisabledDueToFailure && !isRateLimited;
        
        const bots = Array.from(this.clients.values()).map(client => ({
            tag: client.user?.tag || 'Unknown Bot',
            id: client.user?.id || 'Unknown ID',
            avatar: client.user?.displayAvatarURL() || null,
            status: client.user?.presence?.status || 'offline'
        }));
        
        return {
            connected,
            disabled: this.isDisabledDueToFailure,
            rateLimited: isRateLimited,
            rateLimitUntil: isRateLimited ? parseInt(rateLimitUntil) : null,
            lastPing: lastPing ? parseInt(lastPing) : null,
            retryAfter: retryAfter ? parseInt(retryAfter) : null,
            sessionStatus: overallSessionStatus,
            lastError: this.lastFailureError,
            lastFailureTime: this.lastFailureTime,
            botCount: this.clients.size,
            bots,
            activeChannels: this.configs.filter(c => c.isActive).length,
            totalConfigs: this.configs.length
        };
    }

    async forceRetry(): Promise<void> {
        await this.stateRepo.clearDiscordRateLimit();
        await this.stateRepo.setGlobalState('discord_session_token', '0');
        this.isDisabledDueToFailure = false;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.lastFailureError = '';
        this.clients.clear();
        this.sessionSources.clear();
        await this.start();
    }

    async notify(streamer: any, isRecurring: boolean = false, scheduleText: string = ''): Promise<void> {
        if (this.isDisabledDueToFailure) {
            const now = Date.now();
            const cooldown = Math.min(
                this.MIN_COOLDOWN * Math.pow(2, this.failureCount - 1),
                this.MAX_COOLDOWN
            );
            if (now - this.lastFailureTime < cooldown) {
                return;
            }
            this.isDisabledDueToFailure = false;
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
        
                const manager = this.clients.get(config.token);
                if (!manager) continue;
        
                if (await this.isRateLimited()) {
                    console.warn(`[DiscordNotifier] Skipping notification for ${config.channelId} due to global rate limit.`);
                    continue;
                }
        
                await withRetry(
                    async () => {
                        // Use broadcastEval to execute the send logic inside the child process (shard)
                        // This allows us to use the Client instance that lives in the worker.
                        await manager.broadcastEval(async (ctx: any) => {
                            const client = ctx.client;
                            const channel = await client.channels.fetch(config.channelId);
                            if (!channel || !channel.isTextBased()) {
                                throw new Error(`Channel ${config.channelId} not found or not text-based`);
                            }
        
                            const embed = new (require('discord.js').EmbedBuilder)()
                                .setColor(0xFF0000)
                                .setTitle(`${getEnvPrefix()}${streamer.user_name} ${statusText}`)
                                .setDescription(`**Title:** ${streamer.title || 'No title provided'}\n**Link:** https://twitch.tv/${streamer.user_login}`)
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
                    // In a sharded environment, we might need to use broadcastEval to check channel existence
                    // but we can simply mark it inactive in DB.
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
        if (this.isDisabledDueToFailure) {
            const now = Date.now();
            const cooldown = Math.min(
                this.MIN_COOLDOWN * Math.pow(2, this.failureCount - 1),
                this.MAX_COOLDOWN
            );
            if (now - this.lastFailureTime < cooldown) {
                console.warn(`[DiscordNotifier] Broadcast skipped: Service is in cooldown due to login failures.`);
                return;
            }
            this.isDisabledDueToFailure = false;
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
                const manager = this.clients.get(config.token);
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
                const manager = this.clients.get(config.token);
                if (manager) {
                    try {
                        const details = await manager.broadcastEval(async (ctx: any) => {
                            const client = ctx.client;
                            const channel = await client.channels.fetch(config.channelId);
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
