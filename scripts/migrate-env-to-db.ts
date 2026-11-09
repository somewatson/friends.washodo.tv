import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

async function migrate() {
    const dbPath = process.env.DATABASE_PATH || './data/streamers.db';
    const db = new DatabaseSync(dbPath);

    console.log('Starting migration from .env to SQLite...');

    // 1. Migrate Tracked Entities (Streamers, Members, Friends)
    const entities = [
        { list: process.env.WASHODO_MEMBERS, category: 'member' },
        { list: process.env.WASHODO_FRIENDS, category: 'friend' },
        { list: process.env.TRACKED_STREAMERS, category: 'streamer' },
    ];

    const entityStmt = db.prepare('INSERT INTO tracked_entities (username, category) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET category = excluded.category');

    for (const item of entities) {
        if (item.list) {
            const usernames = item.list.split(',').filter(Boolean);
            for (const user of usernames) {
                entityStmt.run(user.trim().toLowerCase(), item.category);
            }
            console.log(`Migrated ${usernames.length} ${item.category}s`);
        }
    }

    // 2. Migrate Mattermost Bots
    const mmBots = process.env.MATTERMOST_BOTS;
    if (mmBots) {
        const bots = mmBots.split(',').filter(Boolean);
        const mmStmt = db.prepare('INSERT INTO mattermost_configs (webhook_token, server_url, bot_token, channel_id) VALUES (?, ?, ?, ?)');
        
        for (const botStr of bots) {
            const [webhookToken, serverUrl, botToken, channelId] = botStr.split('|');
            mmStmt.run(webhookToken || '', serverUrl || '', botToken || '', channelId || '');
        }
        console.log(`Migrated ${bots.length} Mattermost configurations`);
    }

    console.log('Migration completed successfully.');
}

migrate().catch(console.error);
