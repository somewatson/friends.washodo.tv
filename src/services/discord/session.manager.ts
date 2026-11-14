import { ShardingManager } from 'discord.js';
import { getEnvPrefix } from '../../utils/env';
import { DiscordConfig, DiscordSessionInfo, DISCORD_COOLDOWNS } from './types';

export class DiscordSessionManager {
    public clients: Map<string, any> = new Map();
    public sessionSources: Map<string, 'Cached' | 'Fresh'> = new Map();
    private stateRepo: any;
    
    public isDisabledDueToFailure = false;
    public lastFailureTime = 0;
    public failureCount = 0;
    public lastFailureError: string = '';

    constructor(stateRepo: any) {
        this.stateRepo = stateRepo;
    }

    async start(configs: DiscordConfig[]): Promise<void> {
        const env = getEnvPrefix();
        if (this.isDisabledDueToFailure) {
            const now = Date.now();
            const cooldown = Math.min(
                DISCORD_COOLDOWNS.MIN * Math.pow(2, this.failureCount - 1),
                DISCORD_COOLDOWNS.MAX
            );
            if (now - this.lastFailureTime < cooldown) {
                console.warn(`${env}[DiscordNotifier] Service is in cooldown due to ${this.failureCount} previous failures. Skipping login attempts until ${new Date(this.lastFailureTime + cooldown).toISOString()}. (Next interval: ${Math.round(cooldown / 60000)}m)`);
                return;
            }
            console.log(`${env}[DiscordNotifier] Cooldown period expired. Attempting login...`);
            this.isDisabledDueToFailure = false;
        }

        console.log(`${env}[DiscordNotifier] Starting Discord bots via ShardingManager...`);

        for (const config of configs) {
            if (this.clients.has(config.token)) continue;

            try {
                const manager = new ShardingManager(process.cwd() + '/dist/bot.js', {
                    token: config.token,
                    totalShards: 1
                });

                const session = await this.stateRepo.getDiscordSession(config.token);
                if (session) {
                    console.log(`${env}[DiscordNotifier] [Decision Point] Bot ...${config.token.slice(-4)}: Persisted session found. Handshake: RESUME`);
                    this.sessionSources.set(config.token, 'Cached');
                    (manager as any).options = {
                        ... (manager as any).options,
                        env: {
                            ... (manager as any).options?.env,
                            DISCORD_SESSION_DATA: JSON.stringify({
                                sessionId: session.sessionId,
                                userSequence: session.userSequence,
                                shardId: session.shardId,
                                shardCount: session.shardCount,
                                resumeURL: session.resumeURL
                            })
                        }
                    };
                } else {
                    console.log(`${env}[DiscordNotifier] [Decision Point] Bot ...${config.token.slice(-4)}: No persisted session found. Handshake: IDENTIFY`);
                    this.sessionSources.set(config.token, 'Fresh');
                }

                manager.on('shardCreate', shard => {
                    console.log(`${env}[DiscordNotifier] Shard ${shard.id} created for bot ...${config.token.slice(-4)}`);
                });

                (manager as any).on('error', (err: any) => {
                    console.error(`${env}[DiscordNotifier] Manager error for bot ...${config.token.slice(-4)}: ${err}`);
                });

                await manager.spawn();

                (manager as any).on('message', async (shard: any, message: any) => {
                    if (message && message.type === 'SESSION_UPDATE') {
                        try {
                            const { token, session } = message;
                            console.log(`${env}[DiscordNotifier] Received session update from shard for bot ...${token.slice(-4)}`);
                            await this.stateRepo.saveDiscordSession(token, {
                                sessionId: session.sessionId,
                                userSequence: session.sequence,
                                shardId: session.shardId,
                                shardCount: session.shardCount,
                                resumeURL: session.resumeURL
                            });
                        } catch (err) {
                            console.error(`${env}[DiscordNotifier] Failed to save session update: ${err}`);
                        }
                    }

                    if (message && message.type === 'SESSION_INVALID') {
                        try {
                            const { token } = message;
                            console.log(`${env}[DiscordNotifier] Clearing invalid session for bot ...${token.slice(-4)}`);
                            await this.stateRepo.deleteDiscordSession(token);
                        } catch (err) {
                            console.error(`${env}[DiscordNotifier] Failed to clear invalid session: ${err}`);
                        }
                    }
                });

                this.clients.set(config.token, manager as any);
                this.isDisabledDueToFailure = false;
                this.failureCount = 0;

            } catch (error: any) {
                this.lastFailureError = error.message || 'Unknown spawn error';
                console.error(`${env}[DiscordNotifier] Failed to spawn bot for channel ${config.channelId}: ${this.lastFailureError}`);
                this.isDisabledDueToFailure = true;
                this.failureCount++;
                this.lastFailureTime = Date.now();
            }
        }

        console.log(`${env}[DiscordNotifier] Discord sharding phase completed.`);
    }

    public get isDisabled() { return this.isDisabledDueToFailure; }

    async resetFailureState(): Promise<void> {
        this.isDisabledDueToFailure = false;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.lastFailureError = '';
        this.clients.clear();
        this.sessionSources.clear();
    }
}
