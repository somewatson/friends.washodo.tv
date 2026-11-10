import { TwitchClient } from './twitch.client';
import tmi from 'tmi.js';

export class TwitchChatClient {
    private clients: Map<string, tmi.Client> = new Map();
    private stateRepo: any;
    private twitchClient: TwitchClient;

    constructor(stateRepo: any, twitchClient: TwitchClient) {
        this.stateRepo = stateRepo;
        this.twitchClient = twitchClient;
    }

    async sendMessage(channel: string, message: string): Promise<void> {
        const client = await this.getOrCreateClient(channel);
        if (client) {
            (client as any).send(channel, message);
            console.log(`[TwitchChatClient] Sent message to ${channel}: ${message}`);
        }
    }

    private async getOrCreateClient(channel: string): Promise<tmi.Client | null> {
        if (this.clients.has(channel)) {
            return this.clients.get(channel)!;
        }

        try {
            // In a real scenario, we would need a dedicated bot account for Twitch Chat.
            // For now, we assume TWITCH_CHAT_BOT_TOKEN is in env or we use a shared bot.
            const botToken = process.env.TWITCH_CHAT_BOT_TOKEN;
            if (!botToken) {
                console.error('[TwitchChatClient] TWITCH_CHAT_BOT_TOKEN not configured in environment');
                return null;
            }

            const client = new tmi.Client({
                options: { debug: false },
                identity: {
                    username: process.env.TWITCH_CHAT_BOT_USERNAME || 'WashodoWardBot',
                    password: process.env.TWITCH_CHAT_BOT_TOKEN, // tmi.js uses 'password' for oauth token
                }
            });

            await client.connect();
            this.clients.set(channel, client);
            return client;
        } catch (error) {
            console.error(`[TwitchChatClient] Failed to connect to Twitch chat for ${channel}:`, error);
            return null;
        }
    }

    async stop() {
        for (const client of this.clients.values()) {
            client.disconnect();
        }
        this.clients.clear();
    }
}
