import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TwitchClient } from './twitchClient';

dotenv.config();

export class ApiServer {
    private app = express();
    private port = process.env.PORT || 3000;
    private apiKey = process.env.API_KEY;
    private twitch = new TwitchClient();
    private server: any;

    constructor() {
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors({
            origin: ['https://www.washodo.tv', 'http://localhost:3000']
        }));
        this.app.use(express.json());
        // Removed express.static('public') because it serves index.html as a static file,
        // which takes precedence over our root route handler.
        
        // API Key Authentication Middleware
        this.app.use((req, res, next) => {
            const providedKey = req.header('X-API-KEY');
            // Bypass auth for the root page and its status API requests
            if (req.path === '/' || req.path.startsWith('/api/status/') || req.path === '/api/streamers') {
                return next();
            }
            
            if (!this.apiKey || providedKey === this.apiKey) {
                next();
            } else {
                res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
            }
        });
    }

    private setupRoutes() {
        this.app.get('/', async (req, res) => {
            const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
            const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
            const allStreamers = [...members, ...friends];
            
            try {
                const liveList = await this.twitch.getLiveStreamers(allStreamers);
                const liveUsernames = liveList.map(s => s.user_login.toLowerCase());
                
                const renderGrid = (list: string[]) => {
                    if (list.length === 0) return '<p>No streamers in this tier.</p>';
                    return list.map(username => {
                        const lowerUser = username.toLowerCase();
                        const stream = liveList.find(s => s.user_login.toLowerCase() === lowerUser);
                        const isLive = !!stream;
                        
                        const profilePic = stream?.profile_image_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
                        const thumbnail = stream?.thumbnail_url ? stream.thumbnail_url.replace('{width}', '400').replace('{height}', '225') : '';
                        const title = stream?.title || '';
                        const twitchUrl = `https://twitch.tv/${username}`;

                        return `
                            <a href="${twitchUrl}" target="_blank" class="streamer-card">
                                ${isLive ? `<img src="${thumbnail}" class="stream-thumbnail" alt="Live stream thumbnail">` : ''}
                                <div class="streamer-info">
                                    <div class="user-meta">
                                        <img src="${profilePic}" class="profile-pic" alt="${username}'s avatar">
                                        <span class="username">${username}</span>
                                    </div>
                                    ${isLive ? `<span class="stream-title">${title}</span>` : ''}
                                </div>
                                <div class="status-box">
                                    <span class="status-indicator ${isLive ? 'live' : 'offline'}"></span>
                                    <span class="status-label">${isLive ? 'LIVE' : 'Offline'}</span>
                                </div>
                            </a>`;
                    }).join('');
                };

                const html = `
                    <div class="tier-section">
                        <div class="tier-title">Washodo Members</div>
                        <div class="streamer-grid">${renderGrid(members)}</div>
                    </div>
                    <div class="tier-section">
                        <div class="tier-title">Washodo Friends</div>
                        <div class="streamer-grid">${renderGrid(friends)}</div>
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
