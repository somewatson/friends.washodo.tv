import express from 'express';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { DiscordSessionManager } from './session.manager';
import { DiscordCommandHandler } from './command.handler';
import { getEnvPrefix } from '../../utils/env';
import { DiscordConfig } from './types';
import { StreamerStateRepository } from '../../streamerStateRepository';
import { TwitchClient } from '../../clients/twitch.client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const PORT = process.env.DISCORD_BOT_PORT || 3001;
const app = express();
app.use(express.json());

const stateRepo = new StreamerStateRepository();
const twitchClient = new TwitchClient({ 
    clientId: process.env.TWITCH_CLIENT_ID || '', 
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '' 
});

const commandHandler = new DiscordCommandHandler(stateRepo, twitchClient);
const sessionManager = new DiscordSessionManager(stateRepo, commandHandler);

// Internal API to trigger notifications
app.post('/send', async (req, res) => {
    const { token, channelId, embed } = req.body;
    if (!token || !channelId || !embed) {
        return res.status(400).json({ error: 'Missing token, channelId, or embed data' });
    }

    const client = sessionManager.clients.get(token);
    if (!client) {
        return res.status(404).json({ error: 'Bot client not found for provided token' });
    }

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
            throw new Error('Channel not found or not text-based');
        }

        const discordEmbed = new EmbedBuilder()
            .setColor(embed.color || 0x000000)
            .setTitle(embed.title)
            .setDescription(embed.description)
            .setThumbnail(embed.thumbnail || null)
            .setTimestamp();

        await (channel as any).send({ embeds: [discordEmbed] });
        res.json({ success: true });
    } catch (error: any) {
        console.error(`[BotRunner] Send error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/channel/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const { token } = req.query;

    const client = sessionManager.clients.get(token as string);
    if (!client) return res.status(404).json({ error: 'Bot not found' });

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) throw new Error('Channel not found');
        
        const guild = (channel as any).guild;
        const name = (channel as any).name;

        res.json({
            guildName: guild?.name || 'Unknown Guild',
            channelName: name || 'Unknown Channel'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/guild/:guildId', async (req, res) => {
    const { guildId } = req.params;
    const { token } = req.query;

    const client = sessionManager.clients.get(token as string);
    if (!client) return res.status(404).json({ error: 'Bot not found' });

    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) throw new Error('Guild not found');

        res.json({
            name: guild.name,
            memberCount: guild.memberCount,
            icon: guild.iconURL() || null
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/create-channel', async (req, res) => {
    const { guildId } = req.body;
    // Use the first available bot to manage channels
    const client = sessionManager.clients.values().next().value;
    if (!client) return res.status(500).json({ error: 'No bots online to create channel' });

    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) throw new Error('Guild not found');

        const channels = await guild.channels.fetch();
        const existing = channels.find((c: any) => c?.name === '📯-ward-bot' && (c?.type === 0 || c?.type === 5));

        if (existing) return res.json({ channelId: existing.id });

        let channel;
        try {
            channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: 5, // Announcement channel
                topic: 'Official Twitch notifications for the Washodo community.',
            });
        } catch (e) {
            // Fallback to text channel if announcement channels aren't supported
            channel = await guild.channels.create({
                name: '📯-ward-bot',
                type: 0,
                topic: 'Official Twitch notifications for the Washodo community.',
            });
        }

        res.json({ channelId: channel.id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/status', (req, res) => {
    const bots = Array.from(sessionManager.clients.entries()).map(([token, client]) => ({
        tag: client.user?.tag,
        status: client.user?.presence?.status || 'online',
        presence: client.user?.presence?.status || 'online'
    }));
    res.json({ 
        status: 'online', 
        botCount: sessionManager.clients.size,
        bots 
    });
});

app.post('/restart', (req, res) => {
    console.log('[BotRunner] Restart requested. Exiting process for Docker restart...');
    res.json({ success: true, message: 'Restarting Bot Runner...' });
    // Delay exit slightly to allow response to be sent
    setTimeout(() => process.exit(1), 1000);
});

async function bootstrap() {
    const env = getEnvPrefix();
    console.log(`${env}[BotRunner] Bootstrapping Discord Bot Runner...`);

    try {
        await stateRepo.init();
        const integrations = await stateRepo.getDiscordIntegrations();
        const configs: DiscordConfig[] = integrations.map((i: any) => ({
            token: i.bot_token || process.env.DISCORD_BOT_TOKEN,
            channelId: i.channel_id,
            isActive: Boolean(i.is_active)
        })).filter((c: any) => c.token && c.channelId);

        // Also include env bots
        const discordEnv = process.env.DISCORD_BOTS || '';
        const envConfigs = discordEnv.split(',').filter(Boolean).map(str => {
            const [token, channelId] = str.split('|');
            return (token && channelId) ? { token, channelId, isActive: true } : null;
        }).filter((c): c is DiscordConfig => c !== null);

        const allConfigs = [...configs, ...envConfigs];
        const uniqueConfigs = Array.from(new Map(allConfigs.map(c => [c.channelId, c])).values());

        await sessionManager.start(uniqueConfigs);

        app.listen(PORT, () => {
            console.log(`${env}[BotRunner] Internal API listening on port ${PORT}`);
        });
    } catch (error) {
        console.error(`${env}[BotRunner] Bootstrap failed:`, error);
        process.exit(1);
    }
}

bootstrap();
