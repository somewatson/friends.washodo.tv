import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';

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
    public async createNotificationChannel(guildId: string): Promise<string> {
        try {
            const guild = await this._client.guilds.fetch(guildId);
            if (!guild) throw new Error(`Guild ${guildId} not found`);

            // Check for existing channel with the same name
            const existingChannel = guild.channels.cache.find(c => c.name === '📯-ward-bot');
            if (existingChannel && existingChannel instanceof TextChannel) {
                console.log(`[Discord Client] Found existing channel ${existingChannel.id} for guild ${guildId}`);
                return existingChannel.id;
            }

            const channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: ChannelType.GuildText,
                topic: 'Official Twitch notifications for the Washodo community.',
            });

            if (!channel || !(channel instanceof TextChannel)) {
                throw new Error('Failed to create a valid text channel');
            }

            return channel.id;
        } catch (error: any) {
            console.error('[Discord Client] Error creating channel:', error);
            throw error;
        }
    }

    async sendTestMessage(integration: any) {
        try {
            const guild = await this._client.guilds.fetch(integration.guild_id);
            if (!guild) throw new Error(`Guild ${integration.guild_id} not found`);
            
            const channel = await guild.channels.fetch(integration.channel_id);
            if (!channel || !(channel instanceof TextChannel)) {
                throw new Error('Notification channel not found or is not a text channel');
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
