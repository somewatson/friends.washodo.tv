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
    private twitchClient: any; // Will be TwitchClient

    constructor(stateRepo: any, twitchClient?: any) {
        this.stateRepo = stateRepo;
        this.twitchClient = twitchClient;
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

                await client.login(config.token);
                this.clients.set(config.token, client);
                console.log(`[DiscordNotifier] Bot logged in for channel ${config.channelId}`);
            } catch (error) {
                console.error(`[DiscordNotifier] Failed to login bot for channel ${config.channelId}:`, error);
            }
        });

        await Promise.all(loginPromises);
    }

    private async handleCommand(message: any): Promise<void> {
        const text = message.content.trim();
        if (!text) return;

        const parts = text.split(/\s+/);
        const lowerParts = parts.map((p: string) => p.toLowerCase());

        const commandKeywords = ['help', 'status', 'streamers', 'check', 'schedule'];
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
            if (parts[0]?.startsWith('!') || parts[0]?.startsWith('@')) {
                await message.reply(`I heard you mention me, but I don't recognize a command. Try \`!help\`.`);
            }
            return;
        }

        const command = `!${matchedKeyword}`;
        const args = parts.slice(commandIndex + 1);

        if (command === '!help') {
            await message.reply('🤖 **Bot Help Menu**\n- `!status`: Check current monitoring status\n- `!streamers`: Show all tracked streamers and their status\n- `!check <username>`: Check a specific streamer\n- `!schedule`: View the current stream schedule\n- `!help`: Show this menu');
        } else if (command === '!status') {
            await message.reply('✅ Bot is active and monitoring streamers!');
        } else if (command === '!schedule') {
            const schedule = process.env.BOT_SCHEDULE_TEXT || 'No schedule configured.';
            await message.reply(`📅 **Current Schedule**\n${schedule}`);
        } else if (command === '!streamers') {
            await this.handleListStreamers(message);
        } else if (command === '!check') {
            if (args.length === 0) {
                await message.reply('❌ Please provide a username. Usage: `!check <username>`');
                return;
            }
            await this.handleCheckStreamer(args[0], message);
        }
    }

    private async handleListStreamers(message: any): Promise<void> {
        if (!this.twitchClient) {
            await message.reply('❌ Twitch client not initialized.');
            return;
        }

        const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
        const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
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
                await message.reply(`🔴 **${stream.user_name}** is currently LIVE!\nTitle: ${stream.title}\nLink: https://twitch.tv/${stream.user_login}`);
            } else {
                await message.reply(`⚪ **${username}** is currently offline.`);
            }
        } catch (error) {
            console.error('[DiscordNotifier] Error checking streamer:', error);
            await message.reply(`❌ Error checking status for ${username}.`);
        }
    }

    async notify(streamer: any, isRecurring: boolean = false): Promise<void> {
        if (this.configs.length === 0) {
            console.warn('[DiscordNotifier] No servers configured in DISCORD_BOTS');
            return;
        }

        const statusText = isRecurring ? 'is STILL LIVE!' : 'is now LIVE!';
        const thumbnail = streamer.thumbnail_url 
            ? streamer.thumbnail_url.replace('{width}', '400').replace('{height}', '225') 
            : '';

        const notifications = this.configs.map(async (config) => {
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

                if (!shouldNotify) return;

                const client = this.clients.get(config.token);
                if (!client) return;

                const channel = await client.channels.fetch(config.channelId);
                if (!channel || !channel.isTextBased()) return;

                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle(`${streamer.user_name} ${statusText}`)
                    .setDescription(`**Title:** ${streamer.title}\n**Link:** https://twitch.tv/${streamer.user_login}`)
                    .setThumbnail(thumbnail || null)
                    .setTimestamp();

                await (channel as any).send({ embeds: [embed] });
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
