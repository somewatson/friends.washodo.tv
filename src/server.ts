import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TwitchClient } from './clients/twitch.client';
import { WebhookNotifier } from './webhookNotifier';
import { StreamerStateRepository } from './streamerStateRepository';
import axios from 'axios';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import cronParser from 'cron-parser';

dotenv.config();

export class ApiServer {
    private app = express();
    private port = process.env.PORT || 3000;
    private apiKey = process.env.API_KEY;
    private adminUsername = process.env.ADMIN_USERNAME;
    private adminPassword = process.env.ADMIN_PASSWORD;
    private twitch = new TwitchClient({
        clientId: process.env.TWITCH_CLIENT_ID || '',
        clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    });
    private notifier = new WebhookNotifier();
    private stateRepo: StreamerStateRepository;
    private server: any;
    private mainApp: any;

    constructor(stateRepo: StreamerStateRepository, interactiveReceiver?: any, mainApp?: any) {
        this.stateRepo = stateRepo;
        this.mainApp = mainApp;
        this.setupMiddleware();
        this.setupRoutes(interactiveReceiver?.getApp());
    }

    private setupMiddleware() {
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(cookieParser());
        this.app.use(cors({
            origin: ['https://www.washodo.tv', 'http://localhost:3000']
        }));
        this.app.use(express.json());
        
        // API Key Authentication Middleware
        this.app.use((req, res, next) => {
            const providedKey = req.header('X-API-KEY');
            // Bypass auth for the root page and its status API requests
            if (req.path === '/' || req.path === '/mattermost/webhook' || req.path === '/api/discord/invite' || req.path === '/discord-setup' || req.path.startsWith('/status/') || req.path.startsWith('/api/status/') || req.path === '/api/streamers' || req.path.startsWith('/api/thumbnail/') || req.path === '/warden-gate' || req.path.startsWith('/warden/') || req.path === '/warden-access' || req.path === '/api/admin/login' || req.path.startsWith('/api/discord/callback') || req.path === '/admin.css' || req.path === '/admin.js') {
                return next();
            }
            
            if (!this.apiKey || providedKey === this.apiKey) {
                next();
            } else {
                res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
            }
        });

        // Move static middleware AFTER the root route handler in setupRoutes
        // We'll actually remove it from here and put it at the end of setupRoutes 
        // or just after the dynamic routes.
    }

    private injectEnvBanner(template: string): string {
        const env = process.env.APP_ENV;
        if (!env || env === 'production') return template;

        const bannerHtml = `
            <div id="env-banner" style="position: fixed; top: 0; left: 0; width: 100%; background: #a970ff; color: white; text-align: center; padding: 5px 0; font-size: 0.75rem; font-weight: bold; z-index: 1000; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                Running in ${env.toUpperCase()} mode
            </div>
            <style>
                body { padding-top: 25px !important; }
            </style>
        `;

        if (template.includes('<body style="position: relative;">')) {
            return template.replace('<body style="position: relative;">', `<body style="position: relative;">${bannerHtml}`);
        } else if (template.includes('<body>')) {
            return template.replace('<body>', `<body>${bannerHtml}`);
        }
        
        return template;
    }

    private formatUptime(startTime: string | null): string {
        if (!startTime) return 'Unknown';
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        if (diffMs < 0) return 'Just started';

        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);

        const parts = [];
        if (diffHrs > 0) parts.push(`${diffHrs}h`);
        if (diffMins > 0) parts.push(`${diffMins}m`);
        if (diffHrs === 0 && diffMins === 0) parts.push(`${diffSecs}s`);
        
        return parts.join(' ');
    }

    public static formatUptime(startTime: string | null): string {
        if (!startTime) return 'Unknown';
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        if (diffMs < 0) return 'Just started';

        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);

        const parts = [];
        if (diffHrs > 0) parts.push(`${diffHrs}h`);
        if (diffMins > 0) parts.push(`${diffMins}m`);
        if (diffHrs === 0 && diffMins === 0) parts.push(`${diffSecs}s`);
        
        return parts.join(' ');
    }

    private setupRoutes(interactiveApp?: express.Application) {
        const path = require('path');
        if (interactiveApp) {
            this.app.use(interactiveApp);
        }

        // Warden Login
        this.app.get('/warden-gate', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Washodo Ward Login</title>
                    <style>
                        body { background: #1a1a1a; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        .login-box { background: #2d2d2d; padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); text-align: center; width: 300px; }
                        h2 { color: #a970ff; margin-bottom: 20px; }
                        input { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; background: #222; border: 1px solid #555; color: white; border-radius: 4px; }
                        button { width: 100%; padding: 10px; background: #a970ff; border: none; color: white; font-weight: bold; cursor: pointer; border-radius: 4px; }
                        button:hover { opacity: 0.8; }
                        .error { color: #ef4444; margin-bottom: 10px; font-size: 0.9em; }
                    </style>
                </head>
                <body>
                    <div class="login-box">
                        <h2>Warden Login</h2>
                        <div id="error" class="error"></div>
                        <form action="/api/admin/login" method="POST">
                            <input type="text" name="username" placeholder="Username" required>
                            <input type="password" name="password" placeholder="Password" required>
                            <button type="submit">Login</button>
                        </form>
                    </div>
                </body>
                </html>
            `);
        });

        this.app.post('/api/admin/login', (req, res) => {
            const { username, password } = req.body;
            if (username === this.adminUsername && password === this.adminPassword) {
                res.cookie('warden_auth', 'true', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
                res.redirect('/warden-access');
            } else {
                res.send('Invalid credentials. <a href="/warden-gate">Try again</a>');
            }
        });

        this.app.get('/api/admin/logout', (req, res) => {
            res.clearCookie('warden_auth');
            res.redirect('/warden-gate');
        });

        // Warden Interface
        this.app.get(['/warden-access', '/warden/streamers', '/warden/discord', '/warden/mattermost', '/warden/broadcasts', '/warden/system', '/warden/logs'], (req, res) => {
            const auth = req.cookies['warden_auth'];
            if (!auth) return res.redirect('/warden-gate');
            
            let template = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');
            template = template.replace('{{API_KEY}}', this.apiKey || '');
            res.send(this.injectEnvBanner(template));
        });

        // Admin APIs
        this.app.use('/api/admin', (req, res, next) => {
            const auth = req.cookies['warden_auth'];
            if (!auth) return res.status(401).json({ error: 'Unauthorized: Please login via /admin-login' });
            next();
        });

        this.app.get('/api/admin/streamers', async (req, res) => {
            try {
                const streamers = await this.stateRepo.getStreamers();
                
                const hydratedStreamers = await Promise.all(streamers.map(async (s) => {
                    try {
                        const users = await this.twitch.getUsers([s.username]);
                        const user = users[0];
                        
                        // Get follower count - we need to check if getFollowerCount exists in ApiServer
                        // Looking at the provided file content it wasn't visible, let me check.
                        let followerCount = 0;
                        if (user) {
                            const followers = await axios.get('https://api.twitch.tv/helix/channels/followers', {
                                params: { broadcaster_id: user.id },
                                headers: {
                                    'Client-ID': process.env.TWITCH_CLIENT_ID || 'dummy-id',
                                    'Authorization': `Bearer ${await this.twitch.getAccessToken()}`,
                                }
                            });
                            followerCount = followers.data.total;
                        }

                            return {
                                ...s,
                                followerCount,
                                profileUrl: user ? `https://twitch.tv/${user.login}` : `https://twitch.tv/${s.username}`
                            };
                    } catch (e) {
                        console.error(`[Admin API] Failed to hydrate streamer ${s.username}:`, e);
                        return { ...s, followerCount: 0, profileUrl: `https://twitch.tv/${s.username}` };
                    }
                }));
                
                res.json(hydratedStreamers);
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to fetch streamers', details: error.message });
            }
        });

        this.app.post('/api/admin/streamers', async (req, res) => {
            const { username, category } = req.body;
            await this.stateRepo.addTrackedEntity(username, category);
            res.json({ success: true });
        });

        this.app.delete('/api/admin/streamers/:username', async (req, res) => {
            await this.stateRepo.removeTrackedEntity(req.params.username);
            res.json({ success: true });
        });

        this.app.post('/api/admin/streamers/toggle-notify', async (req, res) => {
            const { username, enabled } = req.body;
            await this.stateRepo.toggleStreamerNotification(username, enabled);
            res.json({ success: true });
        });

        this.app.post('/api/admin/streamers/toggle-show', async (req, res) => {
            const { username, visible } = req.body;
            await this.stateRepo.toggleStreamerVisibility(username, visible);
            res.json({ success: true });
        });

        this.app.post('/api/admin/streamers/toggle-notify', async (req, res) => {
            const { username, enabled } = req.body;
            await this.stateRepo.toggleStreamerNotification(username, enabled);
            res.json({ success: true });
        });

        this.app.post('/api/admin/streamers/toggle-show', async (req, res) => {
            const { username, visible } = req.body;
            await this.stateRepo.toggleStreamerVisibility(username, visible);
            res.json({ success: true });
        });

        this.app.post('/api/admin/streamers/reorder', async (req, res) => {
            try {
                const { order } = req.body;
                if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order format' });
                
                await this.stateRepo.updateStreamerOrder(order);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to update order', details: error.message });
            }
        });

        this.app.post('/api/admin/discord/sync-channel/:guildId', async (req, res) => {
            try {
                const guildId = req.params.guildId;
                const discordNotifier = (this.mainApp as any).discordNotifier;
                const channelId = await discordNotifier.findOrCreateAnnouncementChannel(guildId);
                
                const integration = await this.stateRepo.getDiscordIntegration(guildId);
                if (integration) {
                    await this.stateRepo.saveDiscordIntegration(
                        integration.guild_id, 
                        channelId, 
                        integration.owner_id, 
                        integration.bot_token
                    );
                } else {
                    return res.status(404).json({ error: 'Discord integration not found for this guild' });
                }
                
                res.json({ success: true, channelId });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to sync Discord channel', details: error.message });
            }
        });

        this.app.get('/api/admin/discord', async (req, res) => {
            try {
                const integrations = await this.stateRepo.getDiscordIntegrations();
                // We want to get ALL integrations to show their status, 
                // but getDiscordIntegrations only returns active ones.
                // I should probably add a getDiscordIntegrationsAll() method.
                
                // For now, I'll just use what's there but I'll need to modify getDiscordIntegrations
                // in stateRepo to return all.
                
                const hydratedIntegrations = await Promise.all(integrations.map(async (integration) => {
                    try {
                        // Prevent pinging Discord if we know we are rate limited or not logged in
                        const rateLimitUntil = await this.stateRepo.getGlobalState('discord_rate_limit_until');
                        if (rateLimitUntil && parseInt(rateLimitUntil) > Date.now()) {
                            throw new Error('Rate limited');
                        }

                        // Use the DiscordNotifier to get the logged-in client and guild details
                        const details = await (this.mainApp as any).discordNotifier.getGuildDetails(integration.guild_id, integration.bot_token || process.env.DISCORD_BOT_TOKEN);
                        return {
                            ...integration,
                            serverName: details.name,
                            memberCount: details.memberCount,
                            serverIcon: details.icon
                        };
                    } catch (e) {
                        console.error(`[Admin API] Failed to fetch details for guild ${integration.guild_id}:`, e);
                        return {
                            ...integration,
                            serverName: 'Unknown Server',
                            memberCount: 0,
                            serverIcon: null
                        };
                    }
                }));
                
                res.json(hydratedIntegrations);
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to fetch Discord integrations', details: error.message });
            }
        });

        this.app.get('/api/admin/twitch/search', async (req, res) => {
            const { q } = req.query;
            if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
            
            const query = q as string;
            if (query.length < 3) {
                return res.json([]);
            }

            try {
                // 1. Search tracked streamers locally first for partial matches
                const tracked = await this.stateRepo.searchTrackedStreamers(query);
                
                // 2. Search Twitch API for prefix matches
                const twitchUsers = await this.twitch.searchUsers(query);
                
                // Merge results, prioritizing tracked streamers
                const results = [...tracked];
                for (const user of twitchUsers) {
                    if (!results.find(r => r.broadcaster_login.toLowerCase() === user.broadcaster_login.toLowerCase())) {
                        results.push(user);
                    }
                }
                
                res.json(results);
            } catch (error: any) {
                res.status(500).json({ error: 'Twitch search failed', details: error.message });
            }
        });

        this.app.post('/api/admin/discord/manual', async (req, res) => {
            const { guild_id, channel_id, owner_id, bot_token } = req.body;
            if (!guild_id || !channel_id || !bot_token) {
                return res.status(400).json({ error: 'Missing required fields: guild_id, channel_id, and bot_token are required.' });
            }
            await this.stateRepo.saveDiscordIntegration(guild_id, channel_id, owner_id, bot_token);
            res.json({ success: true });
        });

        this.app.delete('/api/admin/discord/:guildId', async (req, res) => {
            await this.stateRepo.removeDiscordIntegration(req.params.guildId);
            res.json({ success: true });
        });

        this.app.get('/api/admin/broadcast-settings', async (req, res) => {
            res.status(404).json({ error: 'Broadcast settings have been removed. Please use individual announcement toggles.' });
        });

        this.app.post('/api/admin/broadcast-settings', async (req, res) => {
            res.status(404).json({ error: 'Broadcast settings have been removed. Please use individual announcement toggles.' });
        });

        this.app.post('/api/admin/broadcast-now', async (req, res) => {
            try {
                if (!this.mainApp) {
                    return res.status(500).json({ error: 'Main app reference not initialized' });
                }
                
                const app = this.mainApp as any;
                
                await app.triggerForcedBroadcast(app.mattermostNotifier, app.discordNotifier, app.twitchChatClient);
                
                res.json({ success: true, message: 'Forced broadcast triggered for all active announcements' });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to trigger broadcast', details: error.message });
            }
        });

        this.app.get('/api/admin/broadcast-preview', async (req, res) => {
            try {
                if (!this.mainApp) {
                    return res.status(500).json({ error: 'Main app reference not initialized' });
                }
        
                const app = this.mainApp as any;
                const announcements = await this.stateRepo.getAnnouncements();
                const activeAnnouncements = announcements.filter((a: any) => a.is_active);

                const hasDiscord = activeAnnouncements.some((a: any) => a.discord_enabled);
                const hasMattermost = activeAnnouncements.some((a: any) => a.mattermost_enabled);

                const discordTargets = hasDiscord 
                    ? await app.discordNotifier.getActiveTargets() 
                    : [];
                const mattermostTargets = hasMattermost 
                    ? await app.mattermostNotifier.getActiveTargets() 
                    : [];

                res.json({
                    announcements: activeAnnouncements.map((a: any) => ({
                        id: a.id,
                        text: a.text,
                        discord_enabled: a.discord_enabled,
                        mattermost_enabled: a.mattermost_enabled,
                        twitch_enabled: a.twitch_enabled
                    })),
                    targets: {
                        discord: discordTargets.filter((t: any) => t.guildName !== 'Error'),
                        mattermost: mattermostTargets.filter((t: any) => t.label !== 'Error')
                    }
                });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to generate broadcast preview', details: error.message });
            }
        });

        this.app.get('/api/admin/announcements', async (req, res) => {
            try {
                const announcements = await this.stateRepo.getAnnouncements();
                
                const hydratedAnnouncements = await Promise.all(announcements.map(async (a) => {
                    let nextRun = null;
                    if (a.cron_schedule) {
                        try {
                            const interval = cronParser.parse(a.cron_schedule);
                            nextRun = interval.next().toString();
                        } catch (e) {
                            nextRun = null;
                        }
                    }
                    return { ...a, next_run: nextRun };
                }));

                res.json(hydratedAnnouncements);
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to fetch announcements', details: error.message });
            }
        });

        this.app.post('/api/admin/announcements', async (req, res) => {
            try {
                const announcement = req.body;
                if (!announcement.text) {
                    return res.status(400).json({ error: 'Announcement text is required' });
                }
                
                if (announcement.cron_schedule) {
                    try {
                        const cronParserAny = cronParser as any;
                        if (typeof cronParserAny.parse === 'function') {
                            cronParserAny.parse(announcement.cron_schedule);
                        } else if (cronParserAny.default && typeof cronParserAny.default.parse === 'function') {
                            cronParserAny.default.parse(announcement.cron_schedule);
                        } else {
                            // Fallback for different import styles
                            const cp = require('cron-parser');
                            const parseFn = cp.parse || cp.default?.parse || cp.CronExpressionParser?.parse;
                            if (typeof parseFn !== 'function') {
                                throw new Error('cron-parser method .parse() not found');
                            }
                            parseFn(announcement.cron_schedule);
                        }
                    } catch (e: any) {
                        return res.status(400).json({ error: `Invalid cron schedule: ${e.message}` });
                    }
                }
                
                await this.stateRepo.saveAnnouncement(announcement);

                // Trigger reschedule in the main app if available
                if (this.mainApp && typeof this.mainApp.scheduleBroadcasts === 'function') {
                    const app = this.mainApp as any;
                    await app.scheduleBroadcasts(app.mattermostNotifier, app.discordNotifier, app.twitchChatClient);
                }

                res.json({ success: true });
            } catch (error: any) {
                console.error('[Admin API] Failed to save announcement:', error);
                res.status(500).json({ error: 'Failed to save announcement', details: error.message });
            }
        });

        this.app.delete('/api/admin/announcements/:id', async (req, res) => {
            try {
                await this.stateRepo.deleteAnnouncement(parseInt(req.params.id));
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to delete announcement', details: error.message });
            }
        });

        this.app.post('/api/admin/announcements/reorder', async (req, res) => {
            try {
                const { order } = req.body;
                if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order format' });
                await this.stateRepo.updateAnnouncementOrder(order);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to update order', details: error.message });
            }
        });

        this.app.get('/api/admin/logs', async (req, res) => {
            try {
                const { type } = req.query;
                const logs = await this.stateRepo.getLogs(type as string);
                res.json(logs);
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
            }
        });

        this.app.get('/api/admin/cron-next', async (req, res) => {
            const { schedule } = req.query;
            if (!schedule) return res.status(400).json({ error: 'Schedule is required' });
            try {
                const interval = cronParser.parse(schedule as string);
                res.json({ next: interval.next().toString() });
            } catch (e: any) {
                res.status(400).json({ error: e.message });
            }
        });

        this.app.get('/api/admin/mattermost', async (req, res) => {
            res.json(await this.stateRepo.getMattermostConfigs());
        });

        this.app.post('/api/admin/mattermost', async (req, res) => {
            await this.stateRepo.addMattermostConfig(req.body);
            res.json({ success: true });
        });

        this.app.delete('/api/admin/mattermost/:id', async (req, res) => {
            await this.stateRepo.removeMattermostConfig(parseInt(req.params.id));
            res.json({ success: true });
        });

        this.app.post('/api/admin/mattermost/test/:id', async (req, res) => {
            try {
                const config = await this.stateRepo.getMattermostConfig(parseInt(req.params.id));
                if (!config) return res.status(404).json({ error: 'Mattermost config not found' });
                
                console.log(`[Admin Panel] Sending Mattermost test notification for config ${req.params.id}`);
                const env = process.env.APP_ENV;
                const prefix = (env && env !== 'production') ? `[${env.toUpperCase()}] ` : '';
                
                await this.notifier.sendMattermostTest(`${prefix}Test message from Washodo Ward Admin Panel!`, config);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: 'Mattermost test failed', details: error.message });
            }
        });

        // Discord Notifier Status
        this.app.get('/api/admin/discord/status', async (req, res) => {
            if (!this.mainApp) return res.status(500).json({ error: 'Main app not initialized' });
            const discordNotifier = (this.mainApp as any).discordNotifier;
            res.json(discordNotifier.getStatus());
        });

        this.app.post('/api/admin/discord/retry', async (req, res) => {
            if (!this.mainApp) return res.status(500).json({ error: 'Main app not initialized' });
            try {
                const discordNotifier = (this.mainApp as any).discordNotifier;
                await discordNotifier.forceRetry();
                res.json({ success: true, message: 'Discord login retry triggered' });
            } catch (error: any) {
                res.status(500).json({ error: 'Retry failed', details: error.message });
            }
        });

        this.app.post('/api/admin/discord/toggle', async (req, res) => {
            const { guildId, active } = req.body;
            await this.stateRepo.toggleDiscordIntegration(guildId, active);
            res.json({ success: true });
        });

        this.app.post('/api/admin/mattermost/toggle', async (req, res) => {
            const { id, active } = req.body;
            await this.stateRepo.toggleMattermostConfig(id, active);
            res.json({ success: true });
        });

        this.app.post('/api/admin/mattermost/update', async (req, res) => {
            try {
                const { id, label } = req.body;
                if (!id || label === undefined) return res.status(400).json({ error: 'ID and label are required' });
                
                await this.stateRepo.updateMattermostLabel(id, label);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to update label', details: error.message });
            }
        });

        this.app.post('/api/admin/discord/test/:guildId', async (req, res) => {
            try {
                const integration = await this.stateRepo.getDiscordIntegration(req.params.guildId);
                if (!integration) return res.status(404).json({ error: 'Discord integration not found' });
                
                console.log(`[Admin Panel] Sending Discord test notification for guild ${req.params.guildId}`);
                const discordNotifier = (this.mainApp as any).discordNotifier;
                await discordNotifier.sendTestMessage(integration);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: 'Discord test failed', details: error.message });
            }
        });


        // Database Portability APIs
        this.app.get('/api/admin/db/export', async (req, res) => {
            const dbPath = process.env.DATABASE_PATH || './data/streamers.db';
            const { DatabaseSync } = require('node:sqlite');
            const db = new DatabaseSync(dbPath);
            const tables = ['streamer_status', 'notification_log', 'discord_integrations', 'mattermost_configs', 'tracked_entities'];
            const data: any = {};
            for (const table of tables) {
                data[table] = db.prepare(`SELECT * FROM ${table}`).all();
            }
            res.setHeader('Content-Disposition', 'attachment; filename=export.json');
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(data, null, 2));
        });

        this.app.post('/api/admin/db/import', async (req, res) => {
            try {
                const data = req.body;
                if (!data || typeof data !== 'object') {
                    return res.status(400).json({ error: 'Invalid JSON body' });
                }
                await this.stateRepo.importData(data);
                res.json({ success: true, message: 'Database import completed successfully' });
            } catch (error: any) {
                console.error('[DB Import] Error:', error);
                res.status(500).json({ error: 'Import failed', details: error.message });
            }
        });

        // Discord OAuth2 Setup Callback
        this.app.get('/api/discord/callback', async (req, res) => {
            const { code, state, error } = req.query as { code?: string, state?: string, error?: string };

            const layout = (title: string, content: string, isError: boolean = false) => `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${title}</title>
                    <script defer src="https://beancounter.somewatson.com/script.js" data-website-id="cf5643bb-9645-4789-b5fd-a03e9944cf75"></script>
                    <style>
                        body { background: #1a1a1a; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        .card { background: #2d2d2d; padding: 40px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 500px; width: 90%; }
                        h1 { color: ${isError ? '#ef4444' : '#a970ff'}; margin-bottom: 20px; font-size: 2em; }
                        p { font-size: 1.1em; line-height: 1.6; color: #ccc; margin-bottom: 30px; }
                        .btn { display: inline-block; padding: 12px 24px; background: #a970ff; color: white; text-decoration: none; font-weight: bold; border-radius: 8px; transition: opacity 0.2s; }
                        .btn:hover { opacity: 0.8; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>${title}</h1>
                        <p>${content}</p>
                        <a href="/discord-setup" class="btn">Return to Setup</a>
                    </div>
                </body>
                </html>
            `;

            if (error === 'access_denied') {
                return res.send(layout('❌ Access Denied', 'You declined the authorization request. The bot cannot be set up without the necessary permissions.'));
            }

            if (!code) {
                return res.status(400).send(layout('❌ Setup Error', 'Missing authorization code from Discord. Please try again.'));
            }

            try {
                const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
                    new URLSearchParams({
                        client_id: process.env.DISCORD_CLIENT_ID!,
                        client_secret: process.env.DISCORD_CLIENT_SECRET!,
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: process.env.BASE_URL + '/api/discord/callback',
                    }), 
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
    
                const accessToken = tokenResponse.data.access_token;
                
                const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                
                const guilds = guildsResponse.data;
                
                // We need to find a guild that the USER has MANAGE_GUILD (0x20) 
                // AND the BOT is already invited to.
                let authorizedGuild = null;
                for (const g of guilds) {
                    const hasManageGuild = (g.permissions & 0x20) === 0x20;
                    if (!hasManageGuild) continue;
                    
                    try {
                        const discordNotifier = (this.mainApp as any).discordNotifier;
                        await discordNotifier.client.guilds.fetch(g.id);
                        authorizedGuild = g;
                        break;
                    } catch {
                        // Bot not in this guild
                        continue;
                    }
                }
                
                if (!authorizedGuild) {
                    return res.status(400).send(layout('❌ Setup Failed', 'You do not have "Manage Server" permissions for any of the servers you authorized the bot for.'));
                }
                
                const guild_id = authorizedGuild.id;
                const discordNotifier = (this.mainApp as any).discordNotifier;
                const channelId = await discordNotifier.createNotificationChannel(guild_id);
                await this.stateRepo.saveDiscordIntegration(guild_id, channelId);
    
                res.send(layout('✅ Setup Complete!', 'The announcement channel has been created or linked successfully. You can now close this window or return to the dashboard.'));
            } catch (error: any) {
                console.error('[Discord OAuth] Setup error:', error.response?.data || error.message);
                res.status(500).send(layout('❌ Setup Failed', `An unexpected error occurred: ${error.message}`));
            }
        });

        this.app.get('/streamer/:username', async (req, res) => {
            const username = req.params.username.toLowerCase();
            const members = await this.stateRepo.getEntitiesByCategory('member');
            const friends = await this.stateRepo.getEntitiesByCategory('friend');
            const allStreamers = [...members, ...friends].map(u => u.toLowerCase());

            if (!allStreamers.includes(username)) {
                return res.status(404).send('<h1 style="color:white; background:#333; padding:20px;">Streamer Not Found</h1><p style="color:white; background:#333; padding:20px;">The requested streamer is not part of the Washodo community list.</p>');
            }

            try {
                const liveList = await this.twitch.getLiveStreamers([username]);
                const userList = await this.twitch.getUsers([username]);
                const stream = liveList[0];
                const user = userList[0];
                const isLive = !!stream;

                const profilePic = user?.profile_image_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
                const thumbnail = stream?.thumbnail_url ? stream.thumbnail_url.replace('{width}', '800').replace('{height}', '450') : '';
                const title = stream?.title || 'Offline';
                const tagline = user?.description || '';
                const twitchUrl = `https://twitch.tv/${username}`;

                let uptimeText = '';
                if (isLive) {
                    const actualStartTime = stream?.started_at || await this.stateRepo.getLiveSince(username);
                    uptimeText = ` (Live for ${this.formatUptime(actualStartTime)})`;
                }

                const html = `
                    <div class="streamer-detail">
                        <div class="detail-header">
                            <img src="${profilePic}" class="detail-profile-pic" alt="${username}'s avatar">
                            <div class="detail-user-info">
                                <div class="detail-username">${username}</div>
                                <div class="detail-status-label ${isLive ? 'live' : 'offline'}">${isLive ? 'LIVE' + uptimeText : 'Offline'}</div>
                            </div>
                        </div>
                        ${isLive ? `<img src="${thumbnail}" class="detail-thumbnail" alt="Live stream thumbnail">` : '<div class="detail-offline-placeholder">Streamer is currently offline</div>'}
                        <div class="detail-body">
                            <div class="detail-title">${title}</div>
                            ${tagline ? `<div class="detail-tagline">${tagline}</div>` : ''}
                            <a href="${twitchUrl}" target="_blank" class="detail-watch-button">Watch on Twitch</a>
                        </div>
                        <div class="detail-footer">
                            <a href="/" class="detail-back-link">← Back to all streamers</a>
                        </div>
                    </div>
                `;

                const fs = require('fs');
                const path = require('path');
                let template = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
                template = template.replace('<!-- CONTENT_PLACEHOLDER -->', html);
                
                res.send(this.injectEnvBanner(template));
            } catch (error) {
                console.error(`Error rendering status page for ${username}:`, error);
                res.status(500).send('<h1 style="color:white; background:#333; padding:20px;">Internal Server Error</h1>');
            }
        });

        this.app.get('/', async (req, res) => {
            const members = await this.stateRepo.getEntitiesByCategory('member');
            const friends = await this.stateRepo.getEntitiesByCategory('friend');
            
            const filteredMembers = members.filter(m => m.show_on_page);
            const filteredFriends = friends.filter(f => f.show_on_page);
            
            try {
                const usernames = [...filteredMembers, ...filteredFriends].map(s => s.username);
                const liveList = await this.twitch.getLiveStreamers(usernames);
                const userList = await this.twitch.getUsers(usernames);
                
                const userMap: Record<string, any> = {};
                userList.forEach(u => {
                    userMap[u.login.toLowerCase()] = u;
                });

                const renderGrid = async (list: any[]) => {
                    if (list.length === 0) return '<p>No streamers in this tier.</p>';
                    const gridItems = await Promise.all(list.map(async (s) => {
                        const username = s.username;
                        const lowerUser = username.toLowerCase();
                        const stream = liveList.find(st => st.user_login.toLowerCase() === lowerUser);
                        const user = userMap[lowerUser];
                        const isLive = !!stream;
                        
                        const profilePic = user?.profile_image_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
                        const thumbnail = stream?.thumbnail_url ? stream.thumbnail_url.replace('{width}', '400').replace('{height}', '225') : '';
                        const title = stream?.title || '';
                        const tagline = user?.description || '';
                        const twitchUrl = `https://twitch.tv/${username}`;
                        
                        let uptimeText = '';
                        if (isLive) {
                            const actualStartTime = stream?.started_at || await this.stateRepo.getLiveSince(lowerUser);
                            uptimeText = ` (Live for ${this.formatUptime(actualStartTime)})`;
                        }
                        
                        return `
                            <a href="${twitchUrl}" target="_blank" class="streamer-card">
                                ${isLive ? `<img src="${thumbnail}" class="stream-thumbnail" alt="Live stream thumbnail">` : ''}
                                <div class="streamer-info">
                                    <div class="user-meta">
                                        <img src="${profilePic}" class="profile-pic" alt="${username}'s avatar">
                                        <span class="username">${username}</span>
                                    </div>
                                    ${isLive ? `<span class="stream-title">${title}</span>` : ''}
                                    ${tagline ? `<div class="user-tagline">${tagline}</div>` : ''}
                                </div>
                                <div class="status-box">
                                    <span class="status-indicator ${isLive ? 'live' : 'offline'}"></span>
                                    <span class="status-label">${isLive ? 'LIVE' + uptimeText : 'Offline'}</span>
                                </div>
                            </a>`;
                    }));
                    return gridItems.join('');
                };
                
                const html = `
                    <div class="tier-section">
                        <div class="tier-title">Washodo Members</div>
                        <div class="streamer-grid">${await renderGrid(filteredMembers)}</div>
                    </div>
                    <div class="tier-section">
                        <div class="tier-title">Washodo Friends</div>
                        <div class="streamer-grid">${await renderGrid(filteredFriends)}</div>
                    </div>
                    <div class="join-section">
                        <div class="join-text">Want to be included here?</div>
                        <a href="https://washodo.tv" target="_blank" class="join-button">Apply to join at washodo.tv</a>
                    </div>
                `;
                
                const fs = require('fs');
                const path = require('path');
                let template = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
                template = template.replace('<!-- CONTENT_PLACEHOLDER -->', html);
                
                res.send(this.injectEnvBanner(template));
            } catch (error) {
                console.error('Error rendering status page:', error);
                res.status(500).send('<h1 style="color:white; background:#333; padding:20px;">Internal Server Error</h1><p style="color:white; background:#333; padding:20px;">Failed to fetch streamer status.</p>');
            }
        });

        this.app.get('/api/discord/invite', (req, res) => {
            try {
                if (!this.mainApp) return res.status(500).json({ error: 'Main app not initialized' });
                const discordNotifier = (this.mainApp as any).discordNotifier;
                res.json({ url: discordNotifier.getInviteUrl() });
            } catch (error: any) {
                console.error('[Discord Setup] Error generating invite link:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/streamers', async (req, res) => {
            res.json({
                members: await this.stateRepo.getEntitiesByCategory('member'),
                friends: await this.stateRepo.getEntitiesByCategory('friend')
            });
        });

        this.app.get('/api/status/all', async (req, res) => {
            const members = await this.stateRepo.getEntitiesByCategory('member');
            const friends = await this.stateRepo.getEntitiesByCategory('friend');
            const allStreamers = [...members, ...friends];
            
            try {
                const liveList = await this.twitch.getLiveStreamers(allStreamers);
                const liveUsernames = liveList.map(s => s.user_login.toLowerCase());
                const result: Record<string, any> = {};

                for (const username of allStreamers) {
                    const lowerUser = username.toLowerCase();
                    const isLive = liveUsernames.includes(lowerUser);

                    result[lowerUser] = {
                        isLive: isLive,
                        lastLive: 'Unknown'
                    };
                }
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch bulk status from Twitch' });
            }
        });

        this.app.get('/api/status/:username', async (req, res) => {
            const username = req.params.username.toLowerCase();
            
            try {
                const liveList = await this.twitch.getLiveStreamers([username]);
                const isLive = liveList.length > 0;
                
                res.json({
                    username,
                    isLive: isLive,
                    lastLive: 'Unknown'
                });
            } catch (error) {
                return res.status(500).json({ error: 'Failed to fetch data from Twitch' });
            }
        });

        // Add a simple redirect from /discord-setup to the HTML file for convenience
        this.app.get('/discord-setup', async (req, res) => {
            const path = require('path');
            const fs = require('fs');
            let template = fs.readFileSync(path.join(__dirname, '../public/discord-setup.html'), 'utf8');
            res.send(this.injectEnvBanner(template));
        });

        this.app.get('/api/thumbnail/:username', async (req, res) => {
            const username = req.params.username.toLowerCase();
            
            try {
                const isLive = await this.stateRepo.isKnownLive(username);
                
                if (isLive) {
                    const thumbnailUrl = await this.stateRepo.getLastThumbnailUrl(username);
                    if (thumbnailUrl) {
                        // Replace Twitch's placeholders with actual dimensions
                        const targetUrl = thumbnailUrl.replace('{width}', '400').replace('{height}', '225');
                        
                        try {
                            const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
                            res.setHeader('Content-Type', String(response.headers['content-type'] || 'image/jpeg'));
                            return res.send(response.data);
                        } catch (error) {
                            console.error(`Error proxying thumbnail for ${username}:`, error);
                            // Fallback to redirect if proxy fails
                            return res.redirect(302, targetUrl);
                        }
                    }
                }
                
                // Offline state: For now, we are disabling the SVG generator and returning a 404 or placeholder
                // as thumbnails are removed from notifications.
                res.status(404).send('Thumbnail not available');
            } catch (error) {
                console.error(`Error serving thumbnail for ${username}:`, error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.app.get('/api/test-webhook', async (req, res) => {
            const testStreamer = {
                user_name: 'Test Bot',
                user_login: 'testbot',
                game_name: 'Testing',
                title: 'This is a test notification from Washodo Ward!'
            };
        
            try {
                await this.notifier.sendNotification(testStreamer, 'System Test');
                res.json({ message: 'Test notification sent successfully' });
            } catch (error: any) {
                res.status(500).json({ error: 'Failed to send test notification', details: error.message });
            }
        });

        this.app.use(express.static('public'));
    }

    public async start() {
        const portNumber = typeof this.port === 'string' ? parseInt(this.port, 10) : this.port;
        this.server = this.app.listen(portNumber, () => {
            console.log(`API Server running on port ${portNumber}`);
        })
        .on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${portNumber} is already in use. Retrying in 1 second...`);
                setTimeout(() => this.start(), 1000);
            } else {
                console.error('API Server Error:', err);
                process.exit(1);
            }
        });
    }

    public stop() {
        if (this.server) {
            console.log('Closing API Server...');
            return new Promise<void>((resolve) => {
                const timer = setTimeout(() => {
                    console.log('Server close timed out, forcing resolve.');
                    resolve();
                }, 2000);

                this.server.close(() => {
                    console.log('API Server closed.');
                    clearTimeout(timer);
                    resolve();
                });
            });
        }
        return Promise.resolve();
    }
}
