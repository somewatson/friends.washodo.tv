import tmi from 'tmi.js';
import { TwitchClient } from '../clients/twitch.client';
import { BotAccountRepository } from '../repositories/botAccountRepository';
import { TokenManagementService } from './tokenManagementService';
import axios from 'axios';

export class TwitchChatBot {
    private client: tmi.Client | null = null;
    private tokenService: TokenManagementService;

    constructor(
        private twitchClient: TwitchClient,
        private botRepo: BotAccountRepository,
        tokenService: TokenManagementService
    ) {
        this.tokenService = tokenService;
    }

    async start() {
        const account = await this.botRepo.getAccount();
        if (!account) {
            console.log('[TwitchChatBot] No bot account found in database. Bot will not start.');
            return;
        }

        const token = await this.tokenService.getValidAccessToken();
        if (!token) {
            console.error('[TwitchChatBot] Could not obtain valid access token. Bot cannot start.');
            return;
        }

        // Note: tmi.js uses the OAuth token for authentication
        this.client = new tmi.Client({
            options: { 
                debug: false 
            },
            identity: {
                username: account.username,
                password: `oauth:${token}`
            },
            channels: (await this.getTrackedChannels()) || []
        });

        this.client.on('message', (channel, tags, message, self) => {
            if (self) return;
            this.handleMessage(channel, tags, message);
        });

        this.client.on('connected', () => {
            console.log(`[TwitchChatBot] Connected to Twitch IRC as ${account.username}`);
        });

        this.client.on('disconnected', () => {
            console.log('[TwitchChatBot] Disconnected from Twitch IRC');
        });

        try {
            await this.client.connect();
        } catch (error) {
            console.error('[TwitchChatBot] Failed to connect to Twitch:', error);
        }
    }

    private async getTrackedChannels(): Promise<string[]> {
        const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
        const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
        const others = (process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean);
        
        return [...new Set([...members, ...friends, ...others])].map(u => u.toLowerCase());
    }

    private async handleMessage(channel: string, tags: any, message: string) {
        const trimmedText = message.trim();
        if (!trimmedText) return;

        const lowerText = trimmedText.toLowerCase();
        if (!lowerText.startsWith('!')) return;

        const parts = trimmedText.split(/\s+/);
        const command = parts[0]?.toLowerCase();
        if (!command) return;
        const args = parts.slice(1);

        try {
            if (command === '!help') {
                await this.sendResponse(channel, '🤖 **Bot Help Menu**\n- `!status`: Check current monitoring status\n- `!streamers`: Show all tracked streamers and their status\n- `!check <username>`: Check a specific streamer\n- `!schedule`: View the current stream schedule\n- `!help`: Show this menu');
            } else if (command === '!status') {
                await this.sendResponse(channel, '✅ Bot is active and monitoring streamers!');
            } else if (command === '!schedule') {
                const schedule = process.env.BOT_SCHEDULE_TEXT || 'No schedule configured.';
                await this.sendResponse(channel, `📅 **Current Schedule**\n${schedule}`);
            } else if (command === '!streamers') {
                await this.handleListStreamers(channel);
            } else if (command === '!check') {
                if (args.length === 0) {
                    await this.sendResponse(channel, '❌ Please provide a username. Usage: `!check <username>`');
                    return;
                }
                await this.handleCheckStreamer(args[0]!, channel);
            }
        } catch (error) {
            console.error('[TwitchChatBot] Error handling command:', error);
            await this.sendResponse(channel, '❌ An error occurred while processing your command.');
        }
    }

    private async handleListStreamers(channel: string) {
        const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
        const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
        const others = (process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean);
        const allStreamers = [...new Set([...members, ...friends, ...others])];

        if (allStreamers.length === 0) {
            await this.sendResponse(channel, 'No streamers are currently being tracked.');
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
                    const status = isLive ? '🔴 Live' : '⚪ Offline';
                    groupText += `- ${user}: ${status}\n`;
                });
                return groupText;
            };

            response += formatGroup('Members', members);
            response += formatGroup('Friends', friends);
            response += formatGroup('Other', others);

            await this.sendResponse(channel, response.trim());
        } catch (error) {
            console.error('[TwitchChatBot] Error listing streamers:', error);
            await this.sendResponse(channel, '❌ Error fetching streamer statuses.');
        }
    }

    private async handleCheckStreamer(username: string, channel: string) {
        try {
            const liveStreams = await this.twitchClient.getStreamStatus([username]);
            const stream = liveStreams[0];

            if (stream) {
                await this.sendResponse(channel, `🔴 **${stream.user_name || stream.user_login}** is currently LIVE!\nTitle: ${stream.title}\nLink: https://twitch.tv/${stream.user_login}`);
            } else {
                await this.sendResponse(channel, `⚪ **${username}** is currently offline.`);
            }
        } catch (error) {
            console.error('[TwitchChatBot] Error checking streamer:', error);
            await this.sendResponse(channel, `❌ Error checking status for ${username}.`);
        }
    }

    private async sendResponse(channel: string, message: string) {
        if (!this.client) return;
        
        // Twitch chat has a character limit per message (usually 500)
        // We split long messages into chunks if necessary.
        const chunks = message.match(/[\s\S]{1,500}/g) || [];
        for (const chunk of chunks) {
            this.client.say(channel, chunk);
        }
    }
}
