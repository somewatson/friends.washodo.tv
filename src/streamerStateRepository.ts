import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export class StreamerStateRepository {
    private db: any;
    private dbPath = process.env.DATABASE_PATH || './data/streamers.db';

    async init() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS streamer_status (
                username TEXT PRIMARY KEY,
                is_live INTEGER DEFAULT 0,
                live_since TEXT
            )
        `);
        console.log(`Database initialized at ${this.dbPath}`);
    }

    async isKnownLive(username: string): Promise<boolean> {
        const row = await this.db.get('SELECT is_live FROM streamer_status WHERE username = ?', [username.toLowerCase()]);
        return row ? row.is_live === 1 : false;
    }

    async getLiveSince(username: string): Promise<string | null> {
        const row = await this.db.get('SELECT live_since FROM streamer_status WHERE username = ?', [username.toLowerCase()]);
        return row ? row.live_since : null;
    }

    async setLive(username: string, startTime: string) {
        await this.db.run(
            'INSERT INTO streamer_status (username, is_live, live_since) VALUES (?, 1, ?) ON CONFLICT(username) DO UPDATE SET is_live = 1, live_since = ?',
            [username.toLowerCase(), startTime, startTime]
        );
    }

    async setOffline(username: string) {
        await this.db.run(
            'INSERT INTO streamer_status (username, is_live, live_since) VALUES (?, 0, NULL) ON CONFLICT(username) DO UPDATE SET is_live = 0, live_since = NULL',
            [username.toLowerCase()]
        );
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}
