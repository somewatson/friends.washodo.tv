import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';

export class DiscordClient {
    private client: Client;

    constructor() {
        this.client = new Client({
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
        await this.client.login(token);
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

        const scopes = ['bot', 'applications.commands'].join('%20');
        
        // Combine permissions using bitwise OR from discord.js constants
        const permissions = PermissionFlagsBits.ManageChannels 
            | PermissionFlagsBits.ViewChannel 
            | PermissionFlagsBits.SendMessages 
            | PermissionFlagsBits.EmbedLinks 
            | PermissionFlagsBits.ReadMessageHistory 
            | PermissionFlagsBits.SendMessagesInThreads;

        return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}&redirect_uri=${encodeURIComponent(baseUrl + '/api/discord/callback')}&response_type=code&state=guild_id_placeholder`;
    }

    /**
     * Creates the notification channel in the specified guild.
     */
    public async createNotificationChannel(guildId: string): Promise<string> {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) throw new Error(`Guild ${guildId} not found`);

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

    public getClient() {
        return this.client;
    }
}
