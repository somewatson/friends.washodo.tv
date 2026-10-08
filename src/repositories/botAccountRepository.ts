import { DatabaseSync } from 'node:sqlite';

export interface BotAccount {
    username: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

export class BotAccountRepository {
    private db: DatabaseSync | null = null;
    private dbPath = process.env.DATABASE_PATH || './data/streamers.db';

    async init() {
        this.db = new DatabaseSync(this.dbPath);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS bot_accounts (
                username TEXT PRIMARY KEY,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        `);
        
        console.log('[BotAccountRepository] Database initialized');
    }

    async getAccount(): Promise<BotAccount | null> {
        if (!this.db) throw new Error('Database not initialized');
        
        const row = this.db.prepare('SELECT * FROM bot_accounts LIMIT 1').get() as any;
        if (!row) return null;

        return {
            username: row.username,
            accessToken: row.access_token,
            refreshToken: row.refresh_token,
            expiresAt: row.expires_at
        };
    }

    async saveAccount(account: BotAccount) {
        if (!this.db) throw new Error('Database not initialized');
        
        this.db.prepare(`
            INSERT INTO bot_accounts (username, access_token, refresh_token, expires_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token,
                expires_at = excluded.expires_at
        `).run(account.username, account.accessToken, account.refreshToken, account.expiresAt);
    }

    async deleteAccount() {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('DELETE FROM bot_accounts').run();
    }

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
