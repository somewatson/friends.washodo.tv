import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { withRetry, LogThrottler } from '../utils/resilience';
import { getEnvPrefix } from '../utils/env';

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
        this.initializeConfigs().catch(err => console.error(`[DiscordNotifier] Initialization failed: ${err}`));
    }

    private async initializeConfigs(): Promise<void> {
        // 1. Try loading from Database (Preferred)
        try {
            const integrations = await this.stateRepo.getDiscordIntegrations();
            if (integrations && integrations.length > 0) {
                this.configs = integrations.map((i: any) => ({
                    token: i.bot_token || process.env.DISCORD_BOT_TOKEN,
                    channelId: i.channel_id
                })).filter((c: any) => c.token && c.channelId);
                
                if (this.configs.length > 0) {
                    return;
                }
            }
        } catch (err) {
            console.error(`[DiscordNotifier] Error loading configs from DB: ${err}`);
        }

        // 2. Fallback to Environment Variable
        const discordEnv = process.env.DISCORD_BOTS || '';
        const configStrings = discordEnv.split(',').filter(Boolean);

        this.configs = configStrings.map(str => {
            const [token, channelId] = str.split('|');
            if (!token || !channelId) {
                console.warn(`[DiscordNotifier] Invalid server config found in env: ${str}`);
                return null;
            }
            return { token, channelId };
        }).filter((c): c is DiscordConfig => c !== null);
    }

    async syncConfigsFromDb(): Promise<void> {
        const integrations = await this.stateRepo.getDiscordIntegrations();
        if (integrations.length === 0) return;

        // Map DB integrations to the config format
        const dbConfigs = integrations.map((i: any) => ({
            token: i.bot_token || process.env.DISCORD_BOT_TOKEN,
            channelId: i.channel_id
        })).filter((c: any) => c.token && c.channelId);

        // Combine with existing configs (removing duplicates by channelId)
        const allConfigs = [...this.configs, ...dbConfigs];
        const seenChannels = new Set();
        this.configs = allConfigs.filter(c => {
            if (seenChannels.has(c.channelId)) return false;
            seenChannels.add(c.channelId);
            return true;
        });

        console.log(`[DiscordNotifier] Synced ${integrations.length} integrations from DB.`);
    }


    async start(): Promise<void> {
        await this.syncConfigsFromDb();
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

        const commandKeywords = ['help', 'status', 'streamers', 'check', 'schedule', 'setup'];
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
            // Check if the bot was actually mentioned by its User ID
            const botUser = message.client.user;
            const isBotMentioned = message.mentions.users.has(botUser.id);

            if (isBotMentioned && (parts[0]?.startsWith('!') || parts[0]?.startsWith('@'))) {
                await message.reply(`I heard you mention me, but I don't recognize a command. Try \`!help\`.`);
            }
            return;
        }

        const command = `!${matchedKeyword}`;
        const args = parts.slice(commandIndex + 1);

        if (command === '!help') {
            await message.reply('🤖 **Bot Help Menu**\n- `!status`: Check current monitoring status\n- `!streamers`: Show all tracked streamers and their status\n- `!check <username>`: Check a specific streamer\n- `!schedule`: View the current stream schedule\n- `!setup`: Automatically create the announcement channel\n- `!help`: Show this menu');
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
        } else if (command === '!setup') {
            await this.handleSetup(message);
        }
    }

    private async handleSetup(message: any): Promise<void> {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command can only be used in a server.');
                return;
            }

            await message.reply('⚙️ Setting up the announcement channel...');

            // Create the channel
            const channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: 0, // GuildText
                topic: 'Official Twitch notifications for the Washodo community.',
            });

            // Save to DB
            await this.stateRepo.saveDiscordIntegration(
                guild.id, 
                channel.id, 
                message.author.id
            );

            // Update current running configs so notifications start immediately
            await this.syncConfigsFromDb();

            await channel.send(`✅ **Channel created!** I will now post notifications in this channel. \nManaged by: <@${message.author.id}>`);
            await message.reply(`✅ Success! I've created the channel <#${channel.id}>.`);

        } catch (error) {
            console.error('[DiscordNotifier] Setup error:', error);
            await message.reply('❌ Failed to create the announcement channel. Please ensure I have the `Manage Channels` permission.');
        }
    }

    private async handleListStreamers(message: any): Promise<void> {
        if (!this.twitchClient) {
            await message.reply('❌ Twitch client not initialized.');
            return;
        }

        const members = await this.stateRepo.getEntitiesByCategory('member');
        const friends = await this.stateRepo.getEntitiesByCategory('friend');
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
            console.warn('[DiscordNotifier] No servers configured in database or DISCORD_BOTS');
            return;
        }

        const statusText = isRecurring ? 'is STILL LIVE!' : 'is now LIVE!';
        const thumbnail = streamer.thumbnail_url 
            ? streamer.thumbnail_url.replace('{width}', '400').replace('{height}', '225') 
            : '';

        // Process configs sequentially to avoid unbounded concurrency
        for (const config of this.configs) {
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

                if (!shouldNotify) continue;

                const client = this.clients.get(config.token);
                if (!client) continue;

                // Discord.js internal API calls don't take a simple 'timeout' option 
                // in the same way axios does, but we wrap it in withRetry to handle
                // failures and implement a manual timeout using Promise.race if needed.
                // For now, we focus on the retry and isolation logic.
                await withRetry(
                    async () => {
                        const channel = await client.channels.fetch(config.channelId);
                        if (!channel || !channel.isTextBased()) {
                            throw new Error(`Channel ${config.channelId} not found or not text-based`);
                        }

                        const embed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle(`${getEnvPrefix()}${streamer.user_name} ${statusText}`)
                            .setDescription(`**Title:** ${streamer.title}\n**Link:** https://twitch.tv/${streamer.user_login}`)
                            .setThumbnail(thumbnail || null)
                            .setTimestamp();

                        await (channel as any).send({ embeds: [embed] });
                    },
                    3,
                    1000,
                    (err, attempt) => console.log(`[DiscordNotifier] Retry ${attempt} for ${config.channelId} due to: ${err.message}`)
                );

                await this.stateRepo.recordNotification(streamer.user_login, 'discord', config.channelId);
                
            } catch (error) {
                const logKey = `discord_error_${config.channelId}`;
                if (LogThrottler.shouldLog(logKey)) {
                    console.error(`[DiscordNotifier] Persistent failure for ${config.channelId}:`, error);
                }
            }
        }
    }

    async stop(): Promise<void> {
        for (const client of this.clients.values()) {
            client.destroy();
        }
        this.clients.clear();
    }
}
