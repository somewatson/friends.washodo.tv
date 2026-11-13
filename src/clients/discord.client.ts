import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, TextChannel, NewsChannel } from 'discord.js';

export class DiscordClient {
    public get client(): Client {
        return this._client;
    }

    private _client: Client;

    constructor() {
        this._client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });
    }

    /**
     * Initializes the client connection to Discord.
     */
    public async login(stateRepo: any): Promise<void> {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            throw new Error('DISCORD_BOT_TOKEN not configured in environment');
        }

        // Pre-check: Abort if rate-limited
        const rateLimitUntil = await stateRepo.getGlobalState('discord_rate_limit_until');
        if (rateLimitUntil && parseInt(rateLimitUntil) > Date.now()) {
            const waitTime = Math.ceil((parseInt(rateLimitUntil) - Date.now()) / 1000 / 60);
            console.warn(`[Discord Client] Login aborted: Rate limited until ${new Date(parseInt(rateLimitUntil)).toISOString()}. Retry in ${waitTime} minutes.`);
            throw new Error(`Rate limited until ${new Date(parseInt(rateLimitUntil)).toISOString()}`);
        }

        // Session Caching: Check for a cached token first
        const cachedToken = await stateRepo.getGlobalState('discord_session_token');
        if (cachedToken && cachedToken !== '0') {
            try {
                console.log('[Discord Client] Attempting to login with cached session token...');
                await this._client.login(cachedToken);
                console.log('[Discord Client] Logged in successfully using cached session.');
                
                // Log only messages that mention the bot
                this._client.on('messageCreate', (message) => {
                    if (message.author.bot) return;
                    if (!message.mentions.has(this._client.user!)) return;

                    const channelName = (message.channel as any).name || 'DM/Unknown';
                    console.log(`[Discord Chat] ${message.author.tag} in #${channelName}: ${message.content}`);
                });
                return;
            } catch (error: any) {
                const isUnauthorized = error.status === 401 || error.message?.includes('Unauthorized');
                if (isUnauthorized) {
                    console.warn('[Discord Client] Cached session token invalid. Performing fresh login...');
                    await stateRepo.setGlobalState('discord_session_token', '0');
                } else {
                    throw error;
                }
            }
        }

        try {
            await this._client.login(token);
            console.log('[Discord Client] Logged in successfully');
            
            // Cache the token for next time
            await stateRepo.setGlobalState('discord_session_token', token);
        } catch (error: any) {
            // Catch 429 errors or Cloudflare 1015
            const isRateLimit = error.status === 429 || error.message?.includes('1015') || error.message?.includes('rate limit');
            
            if (isRateLimit) {
                const retryAfter = error.response?.headers?.get('retry-after');
                const seconds = retryAfter ? parseInt(retryAfter) : 3600; // Default to 1 hour if not specified
                const expiry = Date.now() + (seconds * 1000);
                
                await stateRepo.setGlobalState('discord_rate_limit_until', expiry.toString());
                await stateRepo.setGlobalState('discord_rate_limit_last_ping', Date.now().toString());
                await stateRepo.setGlobalState('discord_rate_limit_retry_after', seconds.toString());
                console.error(`[Discord Client] Rate limit detected! Ban until ${new Date(expiry).toISOString()} (Retry-After: ${seconds}s)`);
                throw new Error(`Discord Rate Limit: retry after ${seconds}s`);
            }
            throw error;
        }

        // Log only messages that mention the bot
        this._client.on('messageCreate', (message) => {
            if (message.author.bot) return;
            if (!message.mentions.has(this._client.user!)) return;

            const channelName = (message.channel as any).name || 'DM/Unknown';
            console.log(`[Discord Chat] ${message.author.tag} in #${channelName}: ${message.content}`);
        });
    }

    /**
     * Generates the OAuth2 invite URL with the necessary permissions.
     */
    public getInviteUrl(): string {
        const clientId = process.env.DISCORD_CLIENT_ID;
        const baseUrl = process.env.BASE_URL;
        if (!clientId || !baseUrl) {
            throw new Error('DISCORD_CLIENT_ID or BASE_URL not configured');
        }

        const scopes = ['bot', 'guilds', 'applications.commands'].join('%20');
        
        // Use BigInt to correctly handle 64-bit Discord permissions and avoid 32-bit truncation
        const permissions = 
            BigInt(PermissionFlagsBits.ManageChannels) + 
            BigInt(PermissionFlagsBits.ViewChannel) + 
            BigInt(PermissionFlagsBits.SendMessages) + 
            BigInt(PermissionFlagsBits.EmbedLinks) + 
            BigInt(PermissionFlagsBits.ReadMessageHistory) + 
            BigInt(PermissionFlagsBits.SendMessagesInThreads);

        return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions.toString()}&scope=${scopes}&redirect_uri=${encodeURIComponent(baseUrl + '/api/discord/callback')}&response_type=code&state=${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * Creates the notification channel in the specified guild, or returns the existing one if it already exists.
     */
    /**
     * Ensures an announcement channel exists for the guild.
     * If a channel named '📯-ward-bot' exists but is NOT an announcement channel, 
     * it will create a NEW announcement channel to ensure the correct type.
     */
    public async findOrCreateAnnouncementChannel(guildId: string): Promise<string> {
        try {
            const guild = await this._client.guilds.fetch(guildId);
            if (!guild) throw new Error(`Guild ${guildId} not found`);

            const channels = await guild.channels.fetch();
            const existingAnnouncement = channels.find(c => c?.name === '📯-ward-bot' && (c?.type === ChannelType.GuildAnnouncement || c?.type === ChannelType.GuildText));
            
            if (existingAnnouncement) {
                console.log(`[Discord Client] Found existing announcement channel ${existingAnnouncement.id} for guild ${guildId}`);
                return existingAnnouncement.id;
            }

            console.log(`[Discord Client] No announcement channel found for guild ${guildId}. Creating one...`);
            let channel;
            try {
                // Attempt to create as a formal Announcement channel first (requires Community enabled)
                channel = await guild.channels.create({
                    name: '📯-ward-bot',
                    type: ChannelType.GuildAnnouncement,
                    topic: 'Official Twitch notifications for the Washodo community.',
                });
                console.log(`[Discord Client] Successfully created GuildAnnouncement channel for guild ${guildId}`);
            } catch (announcementError: any) {
                // Discord returns 50035 (Invalid Form Body) if Community features are not enabled
                if (announcementError.code === 50035 || announcementError.message?.includes('Invalid Form Body')) {
                    console.log(`[Discord Client] Community features not enabled for guild ${guildId}. Falling back to GuildText...`);
                    channel = await guild.channels.create({
                        name: '📯-ward-bot',
                        type: ChannelType.GuildText,
                        topic: 'Official Twitch notifications for the Washodo community.',
                    });
                } else {
                    throw announcementError;
                }
            }

            if (!channel) {
                throw new Error('Failed to create announcement channel');
            }

            return channel.id;
        } catch (error: any) {
            console.error('[Discord Client] Error in findOrCreateAnnouncementChannel:', error);
            throw error;
        }
    }

    public async createNotificationChannel(guildId: string): Promise<string> {
        return this.findOrCreateAnnouncementChannel(guildId);
    }

    async sendTestMessage(integration: any) {
        try {
            const guild = await this._client.guilds.fetch(integration.guild_id);
            if (!guild) throw new Error(`Guild ${integration.guild_id} not found`);
            
            const channel = await guild.channels.fetch(integration.channel_id);
            if (!channel || (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel))) {
                throw new Error('Notification channel not found or is not a valid text/announcement channel');
            }
            
            const env = process.env.APP_ENV;
            const prefix = (env && env !== 'production') ? `[${env.toUpperCase()}] ` : '';
            
            await channel.send(`${prefix}Test message from Washodo Ward Admin Panel!`);
            return true;
        } catch (error: any) {
            throw new Error(`Discord test failed: ${error.message}`);
        }
    }

    public async getGuildDetails(guildId: string): Promise<{ name: string, memberCount: number, icon: string | null }> {
        try {
            const guild = await this._client.guilds.fetch(guildId);
            return {
                name: guild.name,
                memberCount: guild.memberCount,
                icon: guild.iconURL()
            };
        } catch (error: any) {
            console.error(`[Discord Client] Error fetching guild details for ${guildId}:`, error);
            throw error;
        }
    }
}
