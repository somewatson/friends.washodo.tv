import tmi from 'tmi.js';
import { TwitchTokenService } from './twitchTokenService';
import { StreamerStateRepository } from '../streamerStateRepository';
import { TwitchClient } from '../twitchClient';

export class TwitchChatBot {
    private client: tmi.Client | null = null;
    private tokenService: TwitchTokenService;
    private stateRepo: StreamerStateRepository;
    private twitchClient: TwitchClient;
    private isConnected = false;

    constructor(tokenService: TwitchTokenService, stateRepo: StreamerStateRepository, twitchClient: TwitchClient) {
        this.tokenService = tokenService;
        this.stateRepo = stateRepo;
        this.twitchClient = twitchClient;
    }

    async start() {
        const token = await this.tokenService.getValidToken();
        if (!token) {
            console.log('Twitch Bot: No valid token available. Skipping start.');
            return;
        }

        // tmi.js uses a different way to authenticate with OAuth tokens.
        // We need the bot's username which is stored in the account.
        const account = await (this.tokenService as any).botRepo.getActiveAccount();
        if (!account) return;

        this.client = new tmi.Client({
            options: { 
                chatOptions: { 
                    auths: { 
                        'oauth:${token}': account.username 
                    } 
                } 
            },
            channels: [] // We'll join channels dynamically or based on streamers
        });

        this.setupHandlers();

        try {
            await this.client.connect();
            this.isConnected = true;
            console.log(`Twitch Bot connected as ${account.username}`);
            
            // Join channels of streamers we care about
            await this.joinStreamerChannels();
        } catch (error) {
            console.error('Twitch Bot connection error:', error);
        }
    }

    private async joinStreamerChannels() {
        const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
        const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
        const allStreamers = [...members, ...friends];

        for (const streamer of allStreamers) {
            try {
                await this.client?.join(streamer.toLowerCase());
            } catch (e) {
                console.error(`Twitch Bot failed to join ${streamer}:`, e);
            }
        }
        console.log(`Twitch Bot joined ${allStreamers.length} channels.`);
    }

    private setupHandlers() {
        if (!this.client) return;

        this.client.on('message', async (channel, tags, message, self) => {
            if (self) return;

            const msg = message.trim().toLowerCase();
            
            // Retrieve bot username to check for mentions
            const account = await (this.tokenService as any).botRepo.getActiveAccount();
            if (!account) return;
            const botName = account.username.toLowerCase();

            // Only respond if the bot is mentioned
            if (!msg.includes(`@${botName}`)) return;

            if (msg.includes('!help')) {
                this.client?.say(channel, 'Washodo Bot Help: !status, !streamers, !check <username>, !schedule');
            } else if (msg.includes('!status')) {
                this.client?.say(channel, 'Washodo Status is live at https://friends.washodo.tv');
            } else if (msg.includes('!streamers')) {
                const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
                const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
                this.client?.say(channel, `Washodo Members: ${members.join(', ')} | Friends: ${friends.join(', ')}`);
            } else if (msg.includes('!check ')) {
                const parts = msg.split(' ');
                const targetIndex = parts.findIndex(p => p === '!check');
                const target = parts[targetIndex + 1];
                if (!target) return;
                
                try {
                    const liveList = await this.twitchClient.getLiveStreamers([target]);
                    const isLive = liveList.length > 0;
                    this.client?.say(channel, `${target} is ${isLive ? 'LIVE' : 'offline'}. Check status at https://friends.washodo.tv/streamer/${target}`);
                } catch (e) {
                    this.client?.say(channel, `Error checking status for ${target}.`);
                }
            } else if (msg.includes('!schedule')) {
                this.client?.say(channel, 'Check the community Discord or website for the latest schedule!');
            }
        });
    }

    async stop() {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
        }
        this.isConnected = false;
    }
}
