import { TwitchClient } from './twitch.client';
import tmi from 'tmi.js';
import { StreamerStateRepository } from '../streamerStateRepository';
 
export class TwitchChatClient {
    private clients: Map<string, tmi.Client> = new Map();
    private stateRepo: StreamerStateRepository;
    private twitchClient: TwitchClient;
    private cooldowns: Map<string, number> = new Map();
 
    constructor(stateRepo: StreamerStateRepository, twitchClient: TwitchClient) {
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
            const config = await this.stateRepo.getIntegrationConfig('washodo');
            const botToken = config?.bot_token || process.env.TWITCH_CHAT_BOT_TOKEN;
            const botUsername = config?.bot_username || process.env.TWITCH_CHAT_BOT_USERNAME || 'WashodoWardBot';
 
            if (!botToken) {
                console.error('[TwitchChatClient] TWITCH_CHAT_BOT_TOKEN not configured in environment or database');
                return null;
            }
 
            const client = new tmi.Client({
                options: { debug: false },
                identity: {
                    username: botUsername,
                    password: botToken,
                }
            });
 
            // Command Handler
            client.on('message', (channel, tags, message, self) => {
                if (self) return;
                this.handleCommand(channel, tags, message);
            });
 
            await client.connect();
            this.clients.set(channel, client);
            return client;
        } catch (error) {
            console.error(`[TwitchChatClient] Failed to connect to Twitch chat for ${channel}:`, error);
            return null;
        }
    }
 
    private async handleCommand(channel: string, tags: any, message: string) {
        if (!message.startsWith('!')) return;
 
        const [cmd, ...args] = message.split(' ');
        const user = tags['username'];
        const cooldownKey = `${user}:${cmd}`;
        const now = Date.now();
 
        if (this.cooldowns.has(cooldownKey) && now - this.cooldowns.get(cooldownKey)! < 300000) { // 5 min cooldown
            return;
        }
 
        console.log(`[TwitchChatClient] Command ${cmd} from ${user} in ${channel}`);
 
        switch (cmd?.toLowerCase()) {
            case '!washodo':
                const blurbs = [
                    'Washodo is the ultimate hub for community stream tracking! 🚀',
                    'Join the Washodo community and never miss a stream again! ✨',
                    'Check out Washodo for a curated list of amazing streamers! 📺'
                ];
                const blurb = blurbs[Math.floor(Math.random() * blurbs.length)];
                await this.sendMessage(channel, `${tags['display-name']}, ${blurb} Visit: https://washodo.tv`);
                this.cooldowns.set(cooldownKey, now);
                break;
 
            case '!status':
                const streamers = await this.stateRepo.getStreamers();
                const live = streamers.filter((s: any) => s.is_live);
                if (live.length === 0) {
                    await this.sendMessage(channel, 'No tracked streamers are currently live! 😴');
                } else {
                    const list = live.map((s: any) => s.username).join(', ');
                    await this.sendMessage(channel, `Currently live: ${list} 🚀`);
                }
                break;
 
            case '!discord':
                await this.sendMessage(channel, `Join the official Washodo Discord: https://discord.gg/washodo`);
                break;
 
            case '!help':
                await this.sendMessage(channel, 'Available commands: !washodo, !status, !discord, !help, !follow, !shoutout');
                break;
 
            case '!follow':
                await this.sendMessage(channel, `${tags['display-name']}, make sure to follow the streamer and check out Washodo! 💜`);
                break;
 
            case '!shoutout':
                if (args.length === 0) return;
                const target = args[0];
                await this.sendMessage(channel, `Let's all show some love to ${target}! Check them out when they are live! 🌟`);
                break;
 
            default:
                break;
        }
    }
 
    async stop() {
        for (const client of this.clients.values()) {
            client.disconnect();
        }
        this.clients.clear();
    }
}