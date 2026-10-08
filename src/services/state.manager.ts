import sqlite3 from 'sqlite3';
import path from 'path';
import { promisify } from 'util';

const DB_PATH = path.join(process.cwd(), 'data', 'streamers.db');

export class StateManager {
  private db: sqlite3.Database;
  private run: any;
  private get: any;
  private all: any;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    
    // Promisify database methods for async/await usage
    this.run = promisify(this.db.run).bind(this.db);
    this.get = promisify(this.db.get).bind(this.db);
    this.all = promisify(this.db.all).bind(this.db);
  }

  async load(): Promise<void> {
    // Ensure the state table exists
    await this.run(`
      CREATE TABLE IF NOT EXISTS streamer_state (
        username TEXT PRIMARY KEY,
        is_live INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_notification_at DATETIME
      )
    `);

    // Migration: Ensure last_notification_at column exists for existing databases
    try {
      const columns = await this.all('PRAGMA table_info(streamer_state)');
      const hasNotificationColumn = columns.some((col: any) => col.name === 'last_notification_at');
      
      if (!hasNotificationColumn) {
        console.log('[StateManager] Migrating database: Adding last_notification_at column...');
        await this.run('ALTER TABLE streamer_state ADD COLUMN last_notification_at DATETIME');
        console.log('[StateManager] Migration successful.');
      }
    } catch (error) {
      console.error('[StateManager] Migration failed:', error);
    }
  }

  async save(): Promise<void> {
    // No longer needs a bulk save since we write to DB in real-time
  }

  async isLive(username: string): Promise<boolean> {
    const row = await this.get('SELECT is_live FROM streamer_state WHERE username = ?', [username]);
    return row ? !!row.is_live : false;
  }

  async setLive(username: string, status: boolean): Promise<void> {
    await this.run(
      'INSERT INTO streamer_state (username, is_live, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(username) DO UPDATE SET is_live = excluded.is_live, updated_at = excluded.updated_at',
      [username, status ? 1 : 0]
    );
  }

  async getLastNotificationTime(username: string): Promise<string | null> {
    const row = await this.get('SELECT last_notification_at FROM streamer_state WHERE username = ?', [username]);
    return row ? row.last_notification_at : null;
  }

  async setLastNotificationTime(username: string, time: string | null): Promise<void> {
    await this.run(
      'UPDATE streamer_state SET last_notification_at = ? WHERE username = ?',
      [time, username]
    );
  }
}
