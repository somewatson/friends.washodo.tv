import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';

dotenv.config();

async function importEnvToDb() {
    const dbPath = process.env.DATABASE_PATH || './data/streamers.db';
    const db = new DatabaseSync(dbPath);

    console.log(`Connecting to database at ${dbPath}...`);

    // 1. Import Tracked Entities from WASHODO_MEMBERS and WASHODO_FRIENDS
    const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
    const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);

    console.log('Importing members...');
    for (const user of members) {
        db.prepare('INSERT INTO tracked_entities (username, category) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET category = excluded.category')
          .run(user.toLowerCase(), 'member');
    }

    console.log('Importing friends...');
    for (const user of friends) {
        db.prepare('INSERT INTO tracked_entities (username, category) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET category = excluded.category')
          .run(user.toLowerCase(), 'friend');
    }

    // 2. Import Mattermost Configs from MATTERMOST_BOTS
    // Format: token|url|channelId|... (Wait, based on .env line 17: sbce5aage7fsxdopreyw3pnnke|https://livingforge.somewatson.com|txgee5jdb7rxmqq7us96sjapyo|9jgpe5q3mb8bxygf5wxpqwesga)
    // The example in .env.example was token1|url1|botToken1|channelId1
    // Let's look at the .env line 17 again: MATTERMOST_BOTS=sbce5aage7fsxdopreyw3pnnke|https://livingforge.somewatson.com|txgee5jdb7rxmqq7us96sjapyo|9jgpe5q3mb8bxygf5wxpqwesga
    // This looks like: webhook_token | server_url | channel_id | bot_token
    const mmBotsRaw = process.env.MATTERMOST_BOTS || '';
    if (mmBotsRaw) {
        const bots = mmBotsRaw.split(',');
        console.log(`Importing ${bots.length} Mattermost bot(s)...`);
        for (let i = 0; i < bots.length; i++) {
            const botStr = bots[i];
            if (!botStr) continue;
            const parts = botStr.split('|');
            if (parts.length >= 4) {
                const [webhook_token, server_url, channel_id, bot_token] = parts;
                db.prepare('INSERT INTO mattermost_configs (server_url, webhook_token, bot_token, channel_id, label) VALUES (?, ?, ?, ?, ?)')
                  .run(server_url || '', webhook_token || '', bot_token || '', channel_id || '', `Imported Bot ${i + 1}`);
            } else {
                console.warn(`Skipping malformed Mattermost bot config: ${bots[i]}`);
            }
        }
    }

    // 3. Import Discord Bots from DISCORD_BOTS
    // Format: token|channelId
    const discordBotsRaw = process.env.DISCORD_BOTS || '';
    if (discordBotsRaw) {
        const bots = discordBotsRaw.split(',');
        console.log(`Importing ${bots.length} Discord bot(s)...`);
        for (const bot of bots) {
            const parts = bot.split('|');
            if (parts.length >= 2) {
                const [token, channel_id] = parts;
                // We don't have a guild_id in the env var usually, so we'll use a placeholder or the token as key
                // Since guild_id is the PK in discord_integrations, we'll use 'env_import' + index
                const guildId = `env_import_${Math.random().toString(36).substr(2, 9)}`;
                db.prepare('INSERT INTO discord_integrations (guild_id, channel_id) VALUES (?, ?)')
                  .run(guildId, channel_id || '');
            } else {
                console.warn(`Skipping malformed Discord bot config: ${bot}`);
            }
        }
    }

    console.log('Import complete!');
}

importEnvToDb().catch(console.error);
