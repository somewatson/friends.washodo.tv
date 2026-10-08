import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import axios from 'axios';

interface DiscordConfig {
    token: string;
    channelId: string;
}

export class DiscordNotifier {
    private clients: Map<string, Client> = new Map();
    private configs: DiscordConfig[] = [];
    private stateRepo: any; // Will be StreamerStateRepository

    constructor(stateRepo: any) {
        this.stateRepo = stateRepo;
        this.initializeConfigs();
    }

    private initializeConfigs(): void {
        const discordEnv = process.env.DISCORD_BOTS || '';
        const configStrings = discordEnv.split(',').filter(Boolean);

        this.configs = configStrings.map(str => {
            const [token, channelId] = str.split('|');
            if (!token || !channelId) {
                console.warn(`[DiscordNotifier] Invalid server config found: ${str}`);
                return null;
            }
            return { token, channelId };
        }).filter((c): c is DiscordConfig => c !== null);
    }

    async start(): Promise<void> {
        const loginPromises = this.configs.map(async (config) => {
            if (this.clients.has(config.token)) return;

            try {
                const client = new Client({
                    intents: [GatewayIntentBits.Guilds]
                });

                await client.login(config.token);
                this.clients.set(config.token, client);
                console.log(`[DiscordNotifier] Bot logged in for channel ${config.channelId}`);
            } catch (error) {
                console.error(`[DiscordNotifier] Failed to login bot for channel ${config.channelId}:`, error);
            }
        });

        await Promise.all(loginPromises);
    }

    async notify(streamer: any, isRecurring: boolean = false): Promise<void> {
        if (this.configs.length === 0) {
            console.warn('[DiscordNotifier] No servers configured in DISCORD_BOTS');
            return;
        }

        const statusText = isRecurring ? 'is STILL LIVE!' : 'is now LIVE!';
        const baseUrl = process.env.BASE_URL || 'https://friends.washodo.tv';
        const thumbnail = `${baseUrl}/api/thumbnail/${streamer.user_login}`;

        const notifications = this.configs.map(async (config) => {
            try {
                // 1. Check if we should notify this specific channel
                const shouldNotify = await this.stateRepo.shouldNotify(
                    streamer.user_login, 
                    'discord', 
                    config.channelId, 
                    isRecurring ? 60 : 0 // Recurring reminders every 60m, initial instant
                );

                if (!shouldNotify) return;

                const client = this.clients.get(config.token);
                if (!client) {
                    console.error(`[DiscordNotifier] Client not found for token ending in ...${config.token.slice(-4)}`);
                    return;
                }

                const channel = await client.channels.fetch(config.channelId);
                if (!channel || !channel.isTextBased()) {
                    console.error(`[DiscordNotifier] Could not find text channel ${config.channelId}`);
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xFF0000) // Live Red
                    .setTitle(`${streamer.user_name} ${statusText}`)
                    .setDescription(`**Title:** ${streamer.title}\n**Link:** https://twitch.tv/${streamer.user_login}`)
                    .setThumbnail(thumbnail)
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

                // 2. Confirm delivery in DB
                await this.stateRepo.recordNotification(streamer.user_login, 'discord', config.channelId);
                
            } catch (error) {
                console.error(`[DiscordNotifier] Failed to notify channel ${config.channelId}:`, error);
            }
        });

        await Promise.all(notifications);
    }

    async stop(): Promise<void> {
        for (const client of this.clients.values()) {
            client.destroy();
        }
        this.clients.clear();
    }
}
