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
                live_since TEXT
            )
        `);
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

    async setLive(username: string, startTime: string) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO streamer_status (username, is_live, live_since) VALUES (?, 1, ?) ON CONFLICT(username) DO UPDATE SET is_live = 1, live_since = ?'
        ).run(username.toLowerCase(), startTime, startTime);
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
