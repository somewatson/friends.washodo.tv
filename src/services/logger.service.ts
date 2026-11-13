import { StreamerStateRepository } from '../streamerStateRepository';

export class Logger {
    private static repo: StreamerStateRepository;

    static init(repo: StreamerStateRepository) {
        this.repo = repo;
    }

    static async log(type: 'BOOT' | 'STREAMER_CHECK' | 'DISCORD_CHAT' | 'MATTERMOST_CHAT' | 'SYSTEM' | 'ERROR', message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
        if (!this.repo) {
            console.error('[Logger] Repository not initialized. Falling back to console.');
            console.log(`[${type}] [${level}] ${message}`);
            return;
        }
        
        try {
            await this.repo.saveLog(type, message, level);
        } catch (e) {
            console.error('[Logger] Failed to save log to DB:', e);
            console.log(`[${type}] [${level}] ${message}`);
        }
    }

    static async info(type: 'BOOT' | 'STREAMER_CHECK' | 'DISCORD_CHAT' | 'MATTERMOST_CHAT' | 'SYSTEM', message: string) {
        await this.log(type, message, 'INFO');
    }

    static async warn(type: 'BOOT' | 'STREAMER_CHECK' | 'DISCORD_CHAT' | 'MATTERMOST_CHAT' | 'SYSTEM', message: string) {
        await this.log(type, message, 'WARN');
    }

    static async error(type: 'BOOT' | 'STREAMER_CHECK' | 'DISCORD_CHAT' | 'MATTERMOST_CHAT' | 'SYSTEM' | 'ERROR', message: string) {
        await this.log(type, message, 'ERROR');
    }
}
