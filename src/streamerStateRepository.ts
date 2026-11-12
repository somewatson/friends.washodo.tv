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
                bot_token TEXT,
                permissions TEXT,
                is_active INTEGER DEFAULT 1,
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
                label TEXT,
                is_active INTEGER DEFAULT 1
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS broadcast_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                cron_schedule TEXT DEFAULT '0 12 * * *',
                is_enabled INTEGER DEFAULT 0
            )
        `);
        
        // Initialize default settings if not present
        this.db.prepare('INSERT OR IGNORE INTO broadcast_settings (id, cron_schedule, is_enabled) VALUES (1, \'0 12 * * *\', 0)').run();

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tracked_entities (
                username TEXT PRIMARY KEY,
                platform TEXT DEFAULT 'twitch',
                category TEXT,
                is_active INTEGER DEFAULT 1,
                notify_enabled INTEGER DEFAULT 1,
                show_on_page INTEGER DEFAULT 1,
                order_index INTEGER DEFAULT 0
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT,
                order_index INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                discord_enabled INTEGER DEFAULT 1,
                mattermost_enabled INTEGER DEFAULT 1,
                twitch_enabled INTEGER DEFAULT 0,
                start_date TEXT,
                end_date TEXT,
                cron_schedule TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS discord_global_state (
                key TEXT PRIMARY KEY,
                value TEXT
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

        const discordColumns = this.db.prepare('PRAGMA table_info(discord_integrations)').all() as any[];
        const discordColumnNames = discordColumns.map(col => col.name);

        if (!discordColumnNames.includes('bot_token')) {
            console.log('[StreamerStateRepository] Migrating: Adding bot_token column to discord_integrations...');
            this.db.exec('ALTER TABLE discord_integrations ADD COLUMN bot_token TEXT');
        }
        if (!discordColumnNames.includes('is_active')) {
            console.log('[StreamerStateRepository] Migrating: Adding is_active column to discord_integrations...');
            this.db.exec('ALTER TABLE discord_integrations ADD COLUMN is_active INTEGER DEFAULT 1');
        }

        const trackedColumns = this.db.prepare('PRAGMA table_info(tracked_entities)').all() as any[];
        const trackedColumnNames = trackedColumns.map(col => col.name);

        if (!trackedColumnNames.includes('order_index')) {
            console.log('[StreamerStateRepository] Migrating: Adding order_index column to tracked_entities...');
            this.db.exec('ALTER TABLE tracked_entities ADD COLUMN order_index INTEGER DEFAULT 0');
        }
        if (!trackedColumnNames.includes('notify_enabled')) {
            console.log('[StreamerStateRepository] Migrating: Adding notify_enabled column to tracked_entities...');
            this.db.exec('ALTER TABLE tracked_entities ADD COLUMN notify_enabled INTEGER DEFAULT 1');
        }
        if (!trackedColumnNames.includes('show_on_page')) {
            console.log('[StreamerStateRepository] Migrating: Adding show_on_page column to tracked_entities...');
            this.db.exec('ALTER TABLE tracked_entities ADD COLUMN show_on_page INTEGER DEFAULT 1');
        }

        const mattermostColumns = this.db.prepare('PRAGMA table_info(mattermost_configs)').all() as any[];
        const mattermostColumnNames = mattermostColumns.map(col => col.name);

        if (!mattermostColumnNames.includes('is_active')) {
            console.log('[StreamerStateRepository] Migrating: Adding is_active column to mattermost_configs...');
            this.db.exec('ALTER TABLE mattermost_configs ADD COLUMN is_active INTEGER DEFAULT 1');
        }

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

    async getStreamers() {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare('SELECT * FROM tracked_entities ORDER BY order_index ASC').all() as any[];
    }

    async getEntitiesByCategory(category: string): Promise<any[]> {
        if (!this.db) throw new Error('Database not initialized');
        const rows = this.db.prepare('SELECT * FROM tracked_entities WHERE category = ? AND is_active = 1 ORDER BY order_index ASC').all(category) as any[];
        return rows;
    }

    async getStreamerUsernamesByCategory(category: string): Promise<string[]> {
        const entities = await this.getEntitiesByCategory(category);
        return entities
            .filter(Boolean)
            .map((s: any) => (typeof s === 'object' && s !== null && s.username) ? String(s.username) : String(s));
    }

    async addTrackedEntity(username: string, category: string) {
        if (!this.db) throw new Error('Database not initialized');
        
        // Set order_index to the current max + 1 for new entries
        const maxOrderRow = this.db.prepare('SELECT MAX(order_index) as maxOrder FROM tracked_entities').get() as { maxOrder: number } | null;
        const nextOrder = (maxOrderRow?.maxOrder || 0) + 1;

        this.db.prepare(
            'INSERT INTO tracked_entities (username, category, order_index) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET category = excluded.category'
        ).run(username.toLowerCase(), category, nextOrder);
    }


    async removeTrackedEntity(username: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM tracked_entities WHERE username = ?').run(username.toLowerCase());
    }

    async toggleStreamerNotification(username: string, enabled: boolean) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('UPDATE tracked_entities SET notify_enabled = ? WHERE username = ?')
            .run(enabled ? 1 : 0, username.toLowerCase());
    }

    async toggleStreamerVisibility(username: string, visible: boolean) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('UPDATE tracked_entities SET show_on_page = ? WHERE username = ?')
            .run(visible ? 1 : 0, username.toLowerCase());
    }

    async updateStreamerOrder(updates: {username: string, orderIndex: number}[]) {
        if (!this.db) throw new Error('Database not initialized');
        
        for (const update of updates) {
            this.db.prepare('UPDATE tracked_entities SET order_index = ? WHERE username = ?')
                .run(update.orderIndex, update.username.toLowerCase());
        }
    }

    async searchTrackedStreamers(query: string): Promise<any[]> {
        if (!this.db) throw new Error('Database not initialized');
        const rows = this.db.prepare('SELECT username FROM tracked_entities WHERE username LIKE ? AND is_active = 1').all(`%${query.toLowerCase()}%`) as { username: string }[];
        return rows.map(row => ({
            broadcaster_login: row.username,
            display_name: row.username, // we don't have display name in tracked_entities
            id: '', // we don't have ID in tracked_entities
            is_live: false // we don't know without calling Twitch
        }));
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

    async getDiscordIntegrations() {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare('SELECT * FROM discord_integrations').all() as any[];
    }

    async removeDiscordIntegration(guildId: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM discord_integrations WHERE guild_id = ?').run(guildId);
    }

    async toggleDiscordIntegration(guildId: string, active: boolean) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('UPDATE discord_integrations SET is_active = ? WHERE guild_id = ?')
            .run(active ? 1 : 0, guildId);
    }

    async toggleMattermostConfig(id: number, active: boolean) {
        if (!this.db) throw new Error('Database not initialized');
        // We need to add is_active to mattermost_configs table if it doesn't exist.
        // But for now, let's assume it exists or we'll add it in init().
        this.db.prepare('UPDATE mattermost_configs SET is_active = ? WHERE id = ?')
            .run(active ? 1 : 0, id);
    }

    async removeMattermostConfig(id: number) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM mattermost_configs WHERE id = ?').run(id);
    }

    async updateMattermostLabel(id: number, label: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('UPDATE mattermost_configs SET label = ? WHERE id = ?')
            .run(label, id);
    }

    async getBroadcastSettings() {
        throw new Error('Deprecated: Use individual announcement settings instead.');
    }

    async saveBroadcastSettings(settings: { cron_schedule: string, is_enabled: boolean }) {
        throw new Error('Deprecated: Use individual announcement settings instead.');
    }

    async getAnnouncements() {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare('SELECT * FROM announcements ORDER BY order_index ASC').all() as any[];
    }

    async saveAnnouncement(announcement: { id?: number, text: string, order_index: number, is_active: boolean, discord_enabled: boolean, mattermost_enabled: boolean, twitch_enabled: boolean, start_date: string | null, end_date: string | null, cron_schedule?: string | null }) {
        if (!this.db) throw new Error('Database not initialized');
        if (announcement.id) {
            this.db.prepare(`
                UPDATE announcements 
                SET text = ?, order_index = ?, is_active = ?, discord_enabled = ?, mattermost_enabled = ?, twitch_enabled = ?, start_date = ?, end_date = ?, cron_schedule = ?
                WHERE id = ?
            `).run(announcement.text, announcement.order_index, announcement.is_active ? 1 : 0, announcement.discord_enabled ? 1 : 0, announcement.mattermost_enabled ? 1 : 0, announcement.twitch_enabled ? 1 : 0, announcement.start_date ?? null, announcement.end_date ?? null, announcement.cron_schedule ?? null, announcement.id);
        } else {
            this.db.prepare(`
                INSERT INTO announcements (text, order_index, is_active, discord_enabled, mattermost_enabled, twitch_enabled, start_date, end_date, cron_schedule) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(announcement.text, announcement.order_index, announcement.is_active ? 1 : 0, announcement.discord_enabled ? 1 : 0, announcement.mattermost_enabled ? 1 : 0, announcement.twitch_enabled ? 1 : 0, announcement.start_date ?? null, announcement.end_date ?? null, announcement.cron_schedule ?? null);
        }
    }

    async deleteAnnouncement(id: number) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    }

    async updateAnnouncementOrder(updates: {id: number, orderIndex: number}[]) {
        if (!this.db) throw new Error('Database not initialized');
        for (const update of updates) {
            this.db.prepare('UPDATE announcements SET order_index = ? WHERE id = ?').run(update.orderIndex, update.id);
        }
    }

    async getGlobalState(key: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT value FROM discord_global_state WHERE key = ?').get(key) as { value: string } | undefined;
        return row ? row.value : null;
    }

    async setGlobalState(key: string, value: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('INSERT INTO discord_global_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    }

    async clearDiscordRateLimit() {
        await this.setGlobalState('discord_rate_limit_until', '0');
    }


    async getDiscordIntegration(guildId: string) {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT * FROM discord_integrations WHERE guild_id = ?').get(guildId);
        return row as any;
    }

    async getMattermostConfig(id: number) {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT * FROM mattermost_configs WHERE id = ?').get(id);
        return row as any;
    }

    async saveDiscordIntegration(guild_id: string, channel_id: string, owner_id?: string, bot_token?: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO discord_integrations (guild_id, channel_id, owner_id, bot_token, is_active) VALUES (?, ?, ?, ?, 1) ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, bot_token = excluded.bot_token, is_active = 1'
        ).run(guild_id, channel_id, owner_id || null, bot_token || null);
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

    async importData(data: any) {
        if (!this.db) throw new Error("Database not initialized");

        if (data.tracked_entities && Array.isArray(data.tracked_entities)) {
            for (const entity of data.tracked_entities) {
                this.db.prepare(
                    "INSERT INTO tracked_entities (username, platform, category, is_active) VALUES (?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET platform = excluded.platform, category = excluded.category, is_active = excluded.is_active"
                ).run(entity.username.toLowerCase(), entity.platform || "twitch", entity.category, entity.is_active || 1);
            }
        }

        if (data.mattermost_configs && Array.isArray(data.mattermost_configs)) {
            for (const config of data.mattermost_configs) {
                this.db.prepare(
                    "INSERT INTO mattermost_configs (id, server_url, webhook_token, bot_token, channel_id, label) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET server_url = excluded.server_url, webhook_token = excluded.webhook_token, bot_token = excluded.bot_token, channel_id = excluded.channel_id, label = excluded.label"
                ).run(config.id, config.server_url, config.webhook_token, config.bot_token, config.channel_id, config.label);
            }
        }

        if (data.discord_integrations && Array.isArray(data.discord_integrations)) {
            for (const integration of data.discord_integrations) {
                this.db.prepare(
                    "INSERT INTO discord_integrations (guild_id, channel_id, owner_id, bot_token) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, bot_token = excluded.bot_token"
                ).run(integration.guild_id, integration.channel_id, integration.owner_id || null, integration.bot_token || null);
            }
        }

        if (data.streamer_status && Array.isArray(data.streamer_status)) {
            for (const status of data.streamer_status) {
                this.db.prepare(
                    "INSERT INTO streamer_status (username, is_live, live_since, last_thumbnail_url, profile_image_url) VALUES (?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET is_live = excluded.is_live, live_since = excluded.live_since, last_thumbnail_url = excluded.last_thumbnail_url, profile_image_url = excluded.profile_image_url"
                ).run(status.username.toLowerCase(), status.is_live || 0, status.live_since, status.last_thumbnail_url, status.profile_image_url);
            }
        }

        if (data.notification_log && Array.isArray(data.notification_log)) {
            for (const log of data.notification_log) {
                this.db.prepare(
                    "INSERT INTO notification_log (username, platform, target_id, sent_at) VALUES (?, ?, ?, ?) ON CONFLICT(username, platform, target_id) DO UPDATE SET sent_at = excluded.sent_at"
                ).run(log.username.toLowerCase(), log.platform, log.target_id, log.sent_at);
            }
        }
    }
}
