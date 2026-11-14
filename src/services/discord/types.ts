export interface DiscordConfig {
    token: string;
    channelId: string;
    isActive: boolean;
}

export interface DiscordSessionInfo {
    sessionId: string;
    userSequence: number;
    shardId: number;
    shardCount: number;
    resumeURL: string;
}

export const DISCORD_COOLDOWNS = {
    MIN: 5 * 60 * 1000, // 5 minutes
    MAX: 60 * 60 * 1000, // 1 hour
};
