import { DatabaseSync } from 'node:sqlite';
import { BotAccount } from './types/bot.types';

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
        console.log(`BotAccountRepository initialized at ${this.dbPath}`);
    }

    async saveAccount(account: BotAccount) {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare(
            'INSERT INTO bot_accounts (username, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET access_token = ?, refresh_token = ?, expires_at = ?'
        ).run(account.username, account.accessToken, account.refreshToken, account.expiresAt, account.accessToken, account.refreshToken, account.expiresAt);
    }

    async getAccount(username: string): Promise<BotAccount | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT * FROM bot_accounts WHERE username = ?').get(username.toLowerCase()) as any;
        if (!row) return null;
        return {
            username: row.username,
            accessToken: row.access_token,
            refreshToken: row.refresh_token,
            expiresAt: row.expires_at
        };
    }

    async getActiveAccount(): Promise<BotAccount | null> {
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

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
