import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TwitchClient } from './twitchClient';
import { StateManager } from './stateManager';

dotenv.config();

export class ApiServer {
    private app = express();
    private port = process.env.PORT || 3000;
    private apiKey = process.env.API_KEY;
    private twitch = new TwitchClient();
    private state = new StateManager();

    constructor() {
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors({
            origin: ['https://www.washodo.tv', 'http://localhost:3000']
        }));
        this.app.use(express.json());

        // API Key Authentication Middleware
        this.app.use((req, res, next) => {
            const providedKey = req.header('X-API-KEY');
            if (!this.apiKey || providedKey === this.apiKey) {
                next();
            } else {
                res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
            }
        });
    }

    private setupRoutes() {
        this.app.get('/api/status/:username', async (req, res) => {
            const username = req.params.username.toLowerCase();
            const currentStatus = this.state.loadState();
            
            // If user is in our tracked list and we have current info, use it
            // Otherwise, fetch from Twitch in real-time for the API
            let streamerData = currentStatus[username];

            if (!streamerData) {
                try {
                    const liveList = await this.twitch.getLiveStreamers([username]);
                    const isLive = liveList.length > 0;
                    
                    streamerData = {
                        isLive: isLive,
                        lastLive: isLive ? new Date().toISOString() : null
                    };
                    
                    // Update state if they are live
                    if (isLive) {
                        const newState = this.state.loadState();
                        newState[username] = streamerData;
                        this.state.saveState(newState);
                    }
                } catch (error) {
                    return res.status(500).json({ error: 'Failed to fetch data from Twitch' });
                }
            }

            res.json({
                username,
                isLive: streamerData?.isLive || false,
                lastLive: streamerData?.lastLive || 'Unknown'
            });
        });
    }

    public start() {
        this.app.listen(this.port, () => {
            console.log(`API Server running on port ${this.port}`);
        });
    }
}
