import { Client, GatewayIntentBits } from 'discord.js';
import { getEnvPrefix } from '../../utils/env';
import { DiscordConfig, DiscordSessionInfo, DISCORD_COOLDOWNS } from './types';
import { DiscordCommandHandler } from './command.handler';

export class DiscordSessionManager {
    public clients: Map<string, Client> = new Map();
    public sessionSources: Map<string, 'Cached' | 'Fresh'> = new Map();
    private stateRepo: any;
    private commandHandler: DiscordCommandHandler;
    
    public isDisabledDueToFailure = false;
    public lastFailureTime = 0;
    public failureCount = 0;
    public lastFailureError: string = '';

    constructor(stateRepo: any, commandHandler: DiscordCommandHandler) {
        this.stateRepo = stateRepo;
        this.commandHandler = commandHandler;
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

        console.log(`${env}[DiscordNotifier] Starting Discord bots...`);

        for (const config of configs) {
            if (this.clients.has(config.token)) continue;

            try {
                const client = new Client({
                    intents: [
                        GatewayIntentBits.Guilds,
                        GatewayIntentBits.GuildMessages,
                        GatewayIntentBits.MessageContent,
                        GatewayIntentBits.GuildPresences
                    ]
                });

                console.log(`${env}[DiscordNotifier] Bot ...${config.token.slice(-4)}: Logging in...`);

                client.on('ready', async () => {
                    console.log(`${env}[DiscordNotifier] Bot ${client.user?.tag} is online.`);
                });

                client.on('messageCreate', async (message) => {
                    await this.commandHandler.handleCommand(message);
                });

                await client.login(config.token);

                this.clients.set(config.token, client);
                this.isDisabledDueToFailure = false;
                this.failureCount = 0;

            } catch (error: any) {
                this.lastFailureError = error.message || 'Unknown login error';
                console.error(`${env}[DiscordNotifier] Failed to login bot for channel ${config.channelId}: ${this.lastFailureError}`);
                this.isDisabledDueToFailure = true;
                this.failureCount++;
                this.lastFailureTime = Date.now();
            }
        }

        console.log(`${env}[DiscordNotifier] Discord client initialization completed.`);
    }

    public get isDisabled() { return this.isDisabledDueToFailure; }

    async resetFailureState(): Promise<void> {
        this.isDisabledDueToFailure = false;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.lastFailureError = '';
        
        for (const client of this.clients.values()) {
            client.destroy();
        }
        this.clients.clear();
        this.sessionSources.clear();
    }
}
