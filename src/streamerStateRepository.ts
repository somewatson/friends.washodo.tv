import { DatabaseSync } from 'node:sqlite';

export class StreamerStateRepository {
    private db: DatabaseSync | null = null;
    private dbPath = process.env.DATABASE_PATH || './data/streamers.db';

    async init() {
        this.db = new DatabaseSync(this.dbPath);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS streamer_status (
                username TEXT PRIMARY KEY,
                is_live INTEGER DEFAULT 0,
                live_since TEXT,
                last_thumbnail_url TEXT,
                profile_image_url TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS notification_log (
                username TEXT,
                platform TEXT,
                target_id TEXT,
                sent_at TEXT,
                PRIMARY KEY (username, platform, target_id)
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS discord_integrations (
                guild_id TEXT PRIMARY KEY,
                channel_id TEXT,
                owner_id TEXT,
                permissions TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS mattermost_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_url TEXT,
                webhook_token TEXT,
                bot_token TEXT,
                channel_id TEXT,
                label TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tracked_entities (
                username TEXT PRIMARY KEY,
                platform TEXT DEFAULT 'twitch',
                category TEXT,
                is_active INTEGER DEFAULT 1
            )
        `);

        // Migration: Ensure necessary columns exist for existing databases

        const columns = this.db.prepare('PRAGMA table_info(streamer_status)').all() as any[];
        const columnNames = columns.map(col => col.name);

        if (!columnNames.includes('last_thumbnail_url')) {
            console.log('[StreamerStateRepository] Migrating: Adding last_thumbnail_url column...');
            this.db.exec('ALTER TABLE streamer_status ADD COLUMN last_thumbnail_url TEXT');
        }
        if (!columnNames.includes('profile_image_url')) {
            console.log('[StreamerStateRepository] Migrating: Adding profile_image_url column...');
            this.db.exec('ALTER TABLE streamer_status ADD COLUMN profile_image_url TEXT');
        }

        console.log(`Database initialized at ${this.dbPath}`);
    }

    async isKnownLive(username: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT is_live FROM streamer_status WHERE username = ?').get(username.toLowerCase());
        return row ? Boolean(row.is_live) : false;
    }

    async getLiveSince(username: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT live_since FROM streamer_status WHERE username = ?').get(username.toLowerCase());
        return row ? (row.live_since as string) : null;
    }

    async getLastThumbnailUrl(username: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT last_thumbnail_url FROM streamer_status WHERE username = ?').get(username.toLowerCase());
        return row ? (row.last_thumbnail_url as string) : null;
    }

    async getProfileImageUrl(username: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT profile_image_url FROM streamer_status WHERE username = ?').get(username.toLowerCase());
        return row ? (row.profile_image_url as string) : null;
    }

    async setLive(username: string, startTime: string, thumbnailUrl: string | null = null, profileImageUrl: string | null = null) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO streamer_status (username, is_live, live_since, last_thumbnail_url, profile_image_url) VALUES (?, 1, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET is_live = 1, live_since = ?, last_thumbnail_url = ?, profile_image_url = ?'
        ).run(username.toLowerCase(), startTime, thumbnailUrl, profileImageUrl, startTime, thumbnailUrl, profileImageUrl);
    }

    async setOffline(username: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO streamer_status (username, is_live, live_since) VALUES (?, 0, NULL) ON CONFLICT(username) DO UPDATE SET is_live = 0, live_since = NULL'
        ).run(username.toLowerCase());
    }

    async getTrackedEntities() {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare('SELECT * FROM tracked_entities').all() as any[];
    }

    async getEntitiesByCategory(category: string): Promise<string[]> {
        if (!this.db) throw new Error('Database not initialized');
        const rows = this.db.prepare('SELECT username FROM tracked_entities WHERE category = ? AND is_active = 1').all(category) as { username: string }[];
        return rows.map(row => row.username);
    }

    async addTrackedEntity(username: string, category: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO tracked_entities (username, category) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET category = excluded.category'
        ).run(username.toLowerCase(), category);
    }

    async removeTrackedEntity(username: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM tracked_entities WHERE username = ?').run(username.toLowerCase());
    }

    async getMattermostConfigs() {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare('SELECT * FROM mattermost_configs').all() as any[];
    }

    async addMattermostConfig(config: { server_url: string, webhook_token: string, bot_token: string, channel_id: string, label: string }) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO mattermost_configs (server_url, webhook_token, bot_token, channel_id, label) VALUES (?, ?, ?, ?, ?)'
        ).run(config.server_url, config.webhook_token, config.bot_token, config.channel_id, config.label);
    }

    async removeMattermostConfig(id: number) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM mattermost_configs WHERE id = ?').run(id);
    }

    async getDiscordIntegrations() {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare('SELECT * FROM discord_integrations').all() as any[];
    }

    async saveDiscordIntegration(guild_id: string, channel_id: string, owner_id?: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO discord_integrations (guild_id, channel_id, owner_id) VALUES (?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id'
        ).run(guild_id, channel_id, owner_id || null);
    }

    async removeDiscordIntegration(guild_id: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM discord_integrations WHERE guild_id = ?').run(guild_id);
    }

    async shouldNotify(username: string, platform: string, targetId: string, intervalMinutes: number): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare(
            'SELECT sent_at FROM notification_log WHERE username = ? AND platform = ? AND target_id = ?'
        ).get(username.toLowerCase(), platform, targetId) as { sent_at: string } | undefined;

        if (!row) return true;

        const sentAt = new Date(row.sent_at).getTime();
        const now = Date.now();
        const diffMinutes = (now - sentAt) / (1000 * 60);

        return diffMinutes >= intervalMinutes;
    }

    async recordNotification(username: string, platform: string, targetId: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO notification_log (username, platform, target_id, sent_at) VALUES (?, ?, ?, ?) ON CONFLICT(username, platform, target_id) DO UPDATE SET sent_at = ?'
        ).run(username.toLowerCase(), platform, targetId, new Date().toISOString(), new Date().toISOString());
    }
}
