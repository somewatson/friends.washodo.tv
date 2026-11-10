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
    public async login(): Promise<void> {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            throw new Error('DISCORD_BOT_TOKEN not configured in environment');
        }
        await this._client.login(token);
        console.log('[Discord Client] Logged in successfully');

        // Log all incoming chat messages
        this._client.on('messageCreate', (message) => {
            if (message.author.bot) return;
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
            const existingAnnouncement = channels.find(c => c?.name === '📯-ward-bot' && c?.type === ChannelType.GuildAnnouncement);
            
            if (existingAnnouncement) {
                console.log(`[Discord Client] Found existing announcement channel ${existingAnnouncement.id} for guild ${guildId}`);
                return existingAnnouncement.id;
            }

            console.log(`[Discord Client] No announcement channel found for guild ${guildId}. Creating one...`);
            const channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: ChannelType.GuildAnnouncement,
                topic: 'Official Twitch notifications for the Washodo community.',
            });

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
