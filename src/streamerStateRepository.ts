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

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
