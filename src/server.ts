import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TwitchClient } from './twitchClient';
import { WebhookNotifier } from './webhookNotifier';
import { StreamerStateRepository } from './streamerStateRepository';
import axios from 'axios';

dotenv.config();

export class ApiServer {
    private app = express();
    private port = process.env.PORT || 3000;
    private apiKey = process.env.API_KEY;
    private twitch = new TwitchClient();
    private notifier = new WebhookNotifier();
    private stateRepo: StreamerStateRepository;
    private server: any;

    constructor(stateRepo: StreamerStateRepository, interactiveReceiver?: any) {
        this.stateRepo = stateRepo;
        this.setupMiddleware();
        this.setupRoutes(interactiveReceiver?.getApp());
    }

    private setupMiddleware() {
        this.app.use(cors({
            origin: ['https://www.washodo.tv', 'http://localhost:3000']
        }));
        this.app.use(express.json());
        
        // API Key Authentication Middleware
        this.app.use((req, res, next) => {
            const providedKey = req.header('X-API-KEY');
            // Bypass auth for the root page and its status API requests
            if (req.path === '/' || req.path === '/mattermost/webhook' || req.path.startsWith('/status/') || req.path.startsWith('/api/status/') || req.path === '/api/streamers' || req.path.startsWith('/api/thumbnail/')) {
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
        if (interactiveApp) {
            this.app.use(interactiveApp);
        }

        this.app.get('/streamer/:username', async (req, res) => {
            const username = req.params.username.toLowerCase();
            const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
            const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
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


            const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
            const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
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

        this.app.get('/api/streamers', (req, res) => {
            res.json({
                members: (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean),
                friends: (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean)
            });
        });

        this.app.get('/api/status/all', async (req, res) => {
            const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
            const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
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
                title: 'This is a test notification from TwitchWatch!'
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

    public start() {
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
