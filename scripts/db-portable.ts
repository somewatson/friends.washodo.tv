import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function run() {
    const dbPath = process.env.DATABASE_PATH || './data/streamers.db';
    const mode = process.argv[2];
    const filePath = process.argv[3];

    if (!mode || !filePath) {
        console.error('Usage: ts-node scripts/db-portable.ts <export|import> <file_path>');
        process.exit(1);
    }

    if (mode === 'export') {
        const db = new DatabaseSync(dbPath);
        const tables = ['streamer_status', 'notification_log', 'discord_integrations', 'mattermost_configs', 'tracked_entities'];
        const data: any = {};

        for (const table of tables) {
            data[table] = db.prepare(`SELECT * FROM ${table}`).all();
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Database exported to ${filePath}`);
    } else if (mode === 'import') {
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const db = new DatabaseSync(dbPath);

        for (const [table, rows] of Object.entries(data)) {
            if (!Array.isArray(rows)) continue;
            
            // Simple import: clear table then insert
            db.exec(`DELETE FROM ${table}`);
            
            if (rows.length === 0) continue;

            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(',');
            const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);

            for (const row of rows) {
                stmt.run(...Object.values(row));
            }
        }
        console.log(`Database imported from ${filePath}`);
    } else {
        console.error('Invalid mode. Use export or import.');
        process.exit(1);
    }
}

run().catch(console.error);
