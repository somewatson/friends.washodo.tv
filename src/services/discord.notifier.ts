import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { withRetry, LogThrottler } from '../utils/resilience';
import { getEnvPrefix } from '../utils/env';

interface DiscordConfig {
    token: string;
    channelId: string;
    isActive: boolean;
}

export class DiscordNotifier {
    private clients: Map<string, Client> = new Map();
    private configs: DiscordConfig[] = [];
    private stateRepo: any; // Will be StreamerStateRepository
    private twitchClient: any; // Will be TwitchClient
    private isDisabledDueToFailure = false;
    private lastFailureTime = 0;
    private readonly COOLDOWN_PERIOD = 24 * 60 * 60 * 1000; // 24 hours

    constructor(stateRepo: any, twitchClient?: any) {
        this.stateRepo = stateRepo;
        this.twitchClient = twitchClient;
        this.initializeConfigs().catch(err => console.error(`[DiscordNotifier] Initialization failed: ${err}`));
    }

    private async initializeConfigs(): Promise<void> {
        // 1. Try loading from Database (Preferred)
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

        // 2. Fallback to Environment Variable
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

        // Map DB integrations to the config format
        const dbConfigs = integrations.map((i: any) => ({
            token: i.bot_token || process.env.DISCORD_BOT_TOKEN,
            channelId: i.channel_id,
            isActive: Boolean(i.is_active)
        })).filter((c: any) => c.token && c.channelId);

        // Combine with existing configs (removing duplicates by channelId OR token)
        const allConfigs = [...this.configs, ...dbConfigs];
        const seenChannels = new Set();
        const seenTokens = new Set();
        
        this.configs = allConfigs.filter(c => {
            if (seenChannels.has(c.channelId)) return false;
            if (seenTokens.has(c.token)) return false;
            
            seenChannels.add(c.channelId);
            seenTokens.add(c.token);
            return true;
        });

        console.log(`[DiscordNotifier] Synced ${integrations.length} integrations from DB. Total unique configs: ${this.configs.length}`);
    }


    private lastFailureError: string = '';

    async start(): Promise<void> {
        await this.syncConfigsFromDb();

        if (this.isDisabledDueToFailure) {
            const now = Date.now();
            if (now - this.lastFailureTime < this.COOLDOWN_PERIOD) {
                console.warn(`[DiscordNotifier] Service is in cooldown due to previous failures. Skipping login attempts until ${new Date(this.lastFailureTime + this.COOLDOWN_PERIOD).toISOString()}.`);
                return;
            }
            console.log(`[DiscordNotifier] Cooldown period expired. Attempting fresh login...`);
            this.isDisabledDueToFailure = false;
        }

        console.log(`[DiscordNotifier] Starting login for ${this.configs.length} bots...`);
        
        const loginPromises = this.configs.map(async (config) => {
            if (this.clients.has(config.token)) return;



                try {
                    const client = new Client({
                        intents: [
                            GatewayIntentBits.Guilds,
                            GatewayIntentBits.GuildMessages,
                            GatewayIntentBits.MessageContent
                        ]
                    });

                    client.on('messageCreate', async (message) => {
                        if (message.author.bot) return;
                        await this.handleCommand(message);
                    });

                    // Wrap login in a timeout to prevent boot-hangs
                    await Promise.race([
                        client.login(config.token),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Discord login timed out after 15s')), 15000)
                        )
                    ]);

                    this.clients.set(config.token, client);
                    console.log(`[DiscordNotifier] [PID:${process.pid}] Bot logged in for channel ${config.channelId}`);
                } catch (error: any) {
                    const errMsg = error.response?.data?.message || error.message || 'Unknown error';
                    
                    // Handle Rate Limits specifically
                    if (error.response?.status === 429 || errMsg.includes('rate limit')) {
                        const retryAfter = error.response?.data?.retry_after || 0;
                        const expiry = Date.now() + (retryAfter * 1000);
                        
                        await this.stateRepo.setGlobalState('discord_rate_limit_until', expiry.toString());
                        await this.stateRepo.setGlobalState('discord_rate_limit_retry_after', retryAfter.toString());
                        await this.stateRepo.setGlobalState('discord_rate_limit_last_ping', Date.now().toString());
                        
                        console.error(`[DiscordNotifier] Rate limit hit for channel ${config.channelId}. Retry after ${retryAfter}s (until ${new Date(expiry).toISOString()})`);
                    }

                    console.error(`[DiscordNotifier] Failed to login bot for channel ${config.channelId}: ${errMsg}`);
                    this.isDisabledDueToFailure = true;
                    this.lastFailureTime = Date.now();
                    this.lastFailureError = errMsg;
                }
        });

        await Promise.allSettled(loginPromises);
        console.log(`[DiscordNotifier] Discord login phase completed.`);
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
            // Check if the bot was actually mentioned by its User ID
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

            // Create the channel
            const channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: 0, // GuildText
                topic: 'Official Twitch notifications for the Washodo community.',
            });

            // Save to DB
            await this.stateRepo.saveDiscordIntegration(
                guild.id, 
                channel.id, 
                message.author.id
            );

            // Update current running configs so notifications start immediately
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

    async getStatus() {
        const rateLimitUntil = await this.stateRepo.getGlobalState('discord_rate_limit_until');
        const lastPing = await this.stateRepo.getGlobalState('discord_rate_limit_last_ping');
        const retryAfter = await this.stateRepo.getGlobalState('discord_rate_limit_retry_after');
        const isRateLimited = rateLimitUntil && parseInt(rateLimitUntil) > Date.now();
        const sessionToken = await this.stateRepo.getGlobalState('discord_session_token');
        const isCached = sessionToken && sessionToken !== '0';

        return {
            connected: this.clients.size > 0 && !this.isDisabledDueToFailure && !isRateLimited,
            disabled: this.isDisabledDueToFailure,
            rateLimited: isRateLimited,
            rateLimitUntil: isRateLimited ? parseInt(rateLimitUntil) : null,
            lastPing: lastPing ? parseInt(lastPing) : null,
            retryAfter: retryAfter ? parseInt(retryAfter) : null,
            sessionStatus: isCached ? 'Cached' : 'Fresh',
            lastError: this.lastFailureError,
            lastFailureTime: this.lastFailureTime,
            botCount: this.clients.size,
            totalConfigs: this.configs.length
        };
    }

    async forceRetry(): Promise<void> {
        await this.stateRepo.clearDiscordRateLimit();
        await this.stateRepo.setGlobalState('discord_session_token', '0');
        this.isDisabledDueToFailure = false;
        this.lastFailureTime = 0;
        this.lastFailureError = '';
        this.clients.clear();
        await this.start();
    }

    async notify(streamer: any, isRecurring: boolean = false, scheduleText: string = ''): Promise<void> {
        if (this.isDisabledDueToFailure) {
            const now = Date.now();
            if (now - this.lastFailureTime < this.COOLDOWN_PERIOD) {
                return; // Silent return during cooldown
            }
            // Cooldown expired, we can try to resume (though start() usually handles this)
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
        
        // Process configs sequentially to avoid unbounded concurrency
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
        
                const client = this.clients.get(config.token);
                if (!client) continue;
        
                // Proactive Rate Limit Check: Check if we are globally rate limited before trying
                const rateLimitUntil = await this.stateRepo.getGlobalState('discord_rate_limit_until');
                if (rateLimitUntil && parseInt(rateLimitUntil) > Date.now()) {
                    console.warn(`[DiscordNotifier] Skipping notification for ${config.channelId} due to global rate limit.`);
                    continue;
                }

                await withRetry(
                    async () => {
                        const channel = await client.channels.fetch(config.channelId);
                        if (!channel || !channel.isTextBased()) {
                            throw new Error(`Channel ${config.channelId} not found or not text-based`);
                        }
        
                        const embed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle(`${getEnvPrefix()}${streamer.user_name} ${statusText}`)
                            .setDescription(`**Title:** ${streamer.title || 'No title provided'}\n**Link:** https://twitch.tv/${streamer.user_login}`)
                            .setThumbnail(thumbnail || null)
                            .setTimestamp();
        
                        const response = await (channel as any).send({ embeds: [embed] });
                        
                        // Header Monitoring: In discord.js, the response is the message. 
                        // Actual HTTP headers are usually hidden, but we can monitor the result.
                        // If the library provides access to the underlying request/response, we'd check it here.
                        // Since discord.js abstracts the REST API, we rely on the error handling for 429s.
                    },
                    3,
                    1000,
                    (err, attempt) => console.log(`[DiscordNotifier] Retry ${attempt} for ${config.channelId} due to: ${err.message}`)
                );
        
                await this.stateRepo.recordNotification(streamer.user_login, 'discord', config.channelId);
                
            } catch (error: any) {
                // Handle permanent failures (bot kicked or channel deleted)
                const isPermanentFailure = 
                    error.message?.includes('not found') || 
                    error.code === 50001 || // Missing Access
                    error.code === 10003;   // Unknown Channel
        
                if (isPermanentFailure) {
                    console.error(`[DiscordNotifier] Permanent failure detected for channel ${config.channelId}. Marking as inactive.`);
                    
                    // We need the guild_id to mark as inactive. 
                    // In current config we only have channelId.
                    // We can try to find the guild_id via the client.
                    const client = this.clients.get(config.token);
                    if (client) {
                        const channel = await client.channels.fetch(config.channelId).catch(() => null);
                        if (channel && 'guildId' in channel) {
                            await this.stateRepo.markDiscordIntegrationInactive(channel.guildId);
                            // Update local configs to stop trying immediately
                            this.configs = this.configs.filter(c => c.channelId !== config.channelId);
                        }
                    }
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
            if (now - this.lastFailureTime < this.COOLDOWN_PERIOD) {
                console.warn(`[DiscordNotifier] Broadcast skipped: Service is in cooldown due to login failures.`);
                return;
            }
            this.isDisabledDueToFailure = false;
        }

        if (this.configs.length === 0) {
            console.warn('[DiscordNotifier] No servers configured for broadcast');
            return;
        }

        // Ensure configs are up-to-date from the database before broadcasting
        await this.syncConfigsFromDb();

        // Filter active configs first to ensure we are iterating through only enabled ones
        const activeConfigs = this.configs.filter(c => c.isActive);
        if (activeConfigs.length === 0) {
            console.warn('[DiscordNotifier] No active servers configured for broadcast');
            return;
        }

        for (const config of activeConfigs) {
            try {
                const client = this.clients.get(config.token);
                if (!client) {
                    console.error(`[DiscordNotifier] No client found for token used in channel ${config.channelId}. Attempting to login...`);
                    
                    // Attempt a lazy login if the client is missing
                    try {
                        const newClient = new Client({
                            intents: [
                                GatewayIntentBits.Guilds,
                                GatewayIntentBits.GuildMessages,
                                GatewayIntentBits.MessageContent
                            ]
                        });
                        await newClient.login(config.token);
                        this.clients.set(config.token, newClient);
                    } catch (loginErr) {
                        console.error(`[DiscordNotifier] Lazy login failed for ${config.channelId}:`, loginErr);
                        continue;
                    }
                }

                const activeClient = this.clients.get(config.token);
                if (!activeClient) continue;

                await withRetry(
                    async () => {
                        const channel = await activeClient.channels.fetch(config.channelId);
                        if (!channel || !channel.isTextBased()) {
                            throw new Error(`Channel ${config.channelId} not found or not text-based`);
                        }

                        const embed = new EmbedBuilder()
                            .setColor(0xa970ff) // Washodo Purple
                            .setTitle(`${getEnvPrefix()}📢 Community Announcement`)
                            .setDescription(text)
                            .setTimestamp();

                        await (channel as any).send({ embeds: [embed] });
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
        // Ensure configs are up-to-date from the database before returning targets
        await this.syncConfigsFromDb();
        const targets = [];
        for (const config of this.configs) {
            if (config.isActive) {
                const client = this.clients.get(config.token);
                if (client) {
                    try {
                        const channel = await client.channels.fetch(config.channelId);
                        targets.push({
                            guildName: (channel as any)?.guild?.name || 'Unknown Guild',
                            channelName: (channel as any)?.name || 'Unknown Channel',
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
