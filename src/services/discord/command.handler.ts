import { DiscordConfig } from './types';
import { UmamiAnalytics } from '../umami.service';

export class DiscordCommandHandler {
    constructor(private stateRepo: any, private twitchClient: any) {}

    async handleCommand(message: any): Promise<void> {
        try {
            if (message.author.bot) return;

            const text = message.content.trim();
            console.log(`[DiscordCommandHandler] Received message: "${text}" from ${message.author.tag}`);

            if (!text) return;

            // Track Discord interaction in Umami
            await UmamiAnalytics.trackEvent('Discord Chat', {
                user: message.author.tag,
                guild: message.guild?.name || 'DM',
                channel: message.channel?.name || 'DM',
                content: text.length > 100 ? text.slice(0, 97) + '...' : text
            });

            // Log Discord interaction to Database
            await this.stateRepo.saveDiscordLog({
                username: message.author.tag,
                guild_name: message.guild?.name || 'DM',
                channel_name: message.channel?.name || 'DM',
                content: text,
                command: (text.startsWith('!') || text.startsWith('<@')) ? text.split(/\s+/)[0] : null
            });


            const botUser = message.client.user;
            const isBotMentioned = message.mentions.users.has(botUser.id);
            const startsWithPrefix = text.startsWith('!');
            const startsWithMention = text.startsWith('<@');

            if (!startsWithPrefix && !startsWithMention) return;

            const parts = text.split(/\s+/);
            const lowerParts = parts.map((p: string) => p.toLowerCase());

            const commandKeywords = ['help', 'status', 'streamers', 'check', 'schedule', 'setup'];
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
                if (isBotMentioned) {
                    console.log(`[DiscordCommandHandler] Bot mentioned but no command found.`);
                    await message.reply(`I heard you mention me, but I don't recognize a command. Try \`!help\`.`);
                }
                return;
            }

            const command = `!${matchedKeyword}`;
            const args = parts.slice(commandIndex + 1);
            console.log(`[DiscordCommandHandler] Matched command: ${command} with args: ${args}`);

            if (command === '!help') {
                await message.reply(`🤖 **Bot Help Menu**
- \`!status\`: Check current monitoring status
- \`!streamers\`: Show all tracked streamers and their status
- \`!check <username>\`: Check a specific streamer
- \`!schedule\`: View the current stream schedule
- \`!setup\`: Automatically create the announcement channel
- \`!help\`: Show this menu`);
            } else if (command === '!status') {
                await message.reply('✅ Bot is active and monitoring streamers!');
            } else if (command === '!schedule') {
                const setting = await this.stateRepo.getBotSetting('schedule_text');
                const schedule = setting?.value || 'No schedule configured.';
                await message.reply(`📅 **Current Schedule**
${schedule}`);
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
        } catch (error: any) {
            console.error(`[DiscordCommandHandler] Error handling command: ${error.message}`);
            try {
                await message.reply('❌ An internal error occurred while processing your command.');
            } catch (replyError: any) {
                console.error(`[DiscordCommandHandler] Failed to send error reply: ${replyError.message}`);
            }
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

            const channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: 0,
                topic: 'Official Twitch notifications for the Washodo community.',
            });

            await this.stateRepo.saveDiscordIntegration(
                guild.id,
                channel.id,
                message.author.id
            );

            await channel.send(`✅ **Channel created!** I will now post notifications in this channel.
Managed by: <@${message.author.id}>`);
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

        const members = await this.stateRepo.getStreamerUsernamesByCategory('member');
        const friends = await this.stateRepo.getStreamerUsernamesByCategory('friend');
        const others = (process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean);
        const allStreamers = [...new Set([...members, ...friends, ...others])];

        if (allStreamers.length === 0) {
            await message.reply('No streamers are currently being tracked.');
            return;
        }

        try {
            const liveStreams = await this.twitchClient.getStreamStatus(allStreamers);
            const liveUsernames = liveStreams.map((s: any) => s.user_login.toLowerCase());

            let responseLines = ['👥 **Tracked Streamers**'];
            const formatGroup = (title: string, list: string[]) => {
                if (list.length === 0) return [];
                const groupLines = [`\n**${title}**`];
                list.forEach(user => {
                    const isLive = liveUsernames.includes(user.toLowerCase());
                    groupLines.push(`- ${user}: ${isLive ? '🔴 Live' : '⚪ Offline'}`);
                });
                return groupLines;
            };

            responseLines.push(...formatGroup('Members', members));
            responseLines.push(...formatGroup('Friends', friends));
            responseLines.push(...formatGroup('Other', others));

            await message.reply(responseLines.join('\n').trim());
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
                await message.reply(`🔴 **${stream.user_name}** is currently LIVE!
Title: ${stream.title || 'No title provided'}
Link: https://twitch.tv/${stream.user_login}`);
            } else {
                await message.reply(`⚪ **${username}** is currently offline.`);
            }
        } catch (error) {
            console.error('[DiscordNotifier] Error checking streamer:', error);
            await message.reply(`❌ Error checking status for ${username}.`);
        }
    }
}
