import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TwitchClient } from './clients/twitch.client';
import { WebhookNotifier } from './webhookNotifier';
import { StreamerStateRepository } from './streamerStateRepository';
import { DiscordClient } from './clients/discord.client';
import axios from 'axios';
import fs from 'fs';
import cookieParser from 'cookie-parser';

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
    private discord = new DiscordClient();
    private notifier = new WebhookNotifier();
    private stateRepo: StreamerStateRepository;
    private server: any;

    constructor(stateRepo: StreamerStateRepository, interactiveReceiver?: any) {
        this.stateRepo = stateRepo;
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
            if (req.path === '/' || req.path === '/mattermost/webhook' || req.path === '/api/discord/invite' || req.path === '/discord-setup' || req.path.startsWith('/status/') || req.path.startsWith('/api/status/') || req.path === '/api/streamers' || req.path.startsWith('/api/thumbnail/') || req.path === '/warden-gate' || req.path.startsWith('/api/discord/callback')) {
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
        this.app.get('/warden-access', (req, res) => {
            const auth = req.cookies['warden_auth'];
            if (!auth) return res.redirect('/warden-gate');



            let template = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');
            template = template.replace('{{API_KEY}}', this.apiKey || '');
            res.send(template);
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
                            const followers = await axios.get('https://api.twitch.tv/helix/users/follows', {
                                params: { user_id: user.id, type: 'user' },
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
                            profileUrl: user ? `https://twitch.tv/${user.login}` : `#`
                        };
                    } catch (e) {
                        console.error(`[Admin API] Failed to hydrate streamer ${s.username}:`, e);
                        return { ...s, followerCount: 0, profileUrl: `#` };
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

        this.app.get('/api/admin/discord', async (req, res) => {
            try {
                const integrations = await this.stateRepo.getDiscordIntegrations();
                
                const hydratedIntegrations = await Promise.all(integrations.map(async (integration) => {
                    try {
                        const details = await this.discord.getGuildDetails(integration.guild_id);
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
            try {
                const users = await this.twitch.searchUsers(q as string);
                res.json(users);
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
                
                const env = process.env.APP_ENV;
                const prefix = (env && env !== 'production') ? `[${env.toUpperCase()}] ` : '';
                
                await this.notifier.sendMattermostTest(`${prefix}Test message from Washodo Ward Admin Panel!`, config);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: 'Mattermost test failed', details: error.message });
            }
        });

        this.app.post('/api/admin/discord/test/:guildId', async (req, res) => {
            try {
                const integration = await this.stateRepo.getDiscordIntegration(req.params.guildId);
                if (!integration) return res.status(404).json({ error: 'Discord integration not found' });
                
                await this.discord.sendTestMessage(integration);
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
                const authorizedGuild = guilds.find((g: any) => (g.permissions & 0x20) === 0x20);
                
                if (!authorizedGuild) {
                    return res.status(400).send(layout('❌ Setup Failed', 'You do not have "Manage Server" permissions for any of the servers you authorized the bot for.'));
                }
                
                const guild_id = authorizedGuild.id;
                const channelId = await this.discord.createNotificationChannel(guild_id);
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

                res.send(template);
            } catch (error) {
                console.error(`Error rendering status page for ${username}:`, error);
                res.status(500).send('<h1 style="color:white; background:#333; padding:20px;">Internal Server Error</h1>');
            }
        });

        this.app.get('/', async (req, res) => {


            const members = await this.stateRepo.getEntitiesByCategory('member');
            const friends = await this.stateRepo.getEntitiesByCategory('friend');
            const allStreamers = [...members, ...friends];
            
            try {
                const liveList = await this.twitch.getLiveStreamers(allStreamers);
                const userList = await this.twitch.getUsers(allStreamers);
                
                const userMap: Record<string, any> = {};
                userList.forEach(u => {
                    userMap[u.login.toLowerCase()] = u;
                });

                const renderGrid = async (list: string[]) => {
                    if (list.length === 0) return '<p>No streamers in this tier.</p>';
                    const gridItems = await Promise.all(list.map(async (username) => {
                        const lowerUser = username.toLowerCase();
                        const stream = liveList.find(s => s.user_login.toLowerCase() === lowerUser);
                        const user = userMap[lowerUser];
                        const isLive = !!stream;
                        
                        const profilePic = user?.profile_image_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
                        const thumbnail = stream?.thumbnail_url ? stream.thumbnail_url.replace('{width}', '400').replace('{height}', '225') : '';
                        const title = stream?.title || '';
                        const tagline = user?.description || '';
                        const twitchUrl = `https://twitch.tv/${username}`;
                        
                        let uptimeText = '';
                        if (isLive) {
                            // Prioritize actual Twitch stream start time if available, otherwise fallback to DB
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
                        <div class="streamer-grid">${await renderGrid(members)}</div>
                    </div>
                    <div class="tier-section">
                        <div class="tier-title">Washodo Friends</div>
                        <div class="streamer-grid">${await renderGrid(friends)}</div>
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
                
                res.send(template);
            } catch (error) {
                console.error('Error rendering status page:', error);
                res.status(500).send('<h1 style="color:white; background:#333; padding:20px;">Internal Server Error</h1><p style="color:white; background:#333; padding:20px;">Failed to fetch streamer status.</p>');
            }
        });

        this.app.get('/api/discord/invite', (req, res) => {
            try {
                const inviteUrl = this.discord.getInviteUrl();
                res.json({ url: inviteUrl });
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
        this.app.get('/discord-setup', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/discord-setup.html'));
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
        // Initialize Discord Client
        try {
            await this.discord.login();
        } catch (error) {
            console.error('[Server] Failed to initialize Discord client:', error);
            // We don't exit here because the server might still be needed for other things, 
            // but Discord functionality will be broken.
        }

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
