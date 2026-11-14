import { StreamerStateRepository } from '../streamerStateRepository';
import { getEnvPrefix } from '../utils/env';

export class Logger {
    private static repo: StreamerStateRepository;

    static init(repo: StreamerStateRepository) {
        this.repo = repo;
    }

    static async log(type: 'BOOT' | 'STREAMER_CHECK' | 'DISCORD_CHAT' | 'MATTERMOST_CHAT' | 'SYSTEM' | 'ERROR', message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
        const prefix = getEnvPrefix();
        const formattedMessage = `${prefix}${message}`;

        if (!this.repo) {
            console.error('[Logger] Repository not initialized. Falling back to console.');
            console.log(`[${type}] [${level}] ${formattedMessage}`);
            return;
        }
        
        try {
            await this.repo.saveLog(type, formattedMessage, level);
        } catch (e) {
            console.error('[Logger] Failed to save log to DB:', e);
            console.log(`[${type}] [${level}] ${formattedMessage}`);
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
