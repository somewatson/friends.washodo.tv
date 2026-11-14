import { Client, GatewayIntentBits } from 'discord.js';
import { StreamerStateRepository } from './streamerStateRepository';
import { getEnvPrefix } from './utils/env';

/**
 * This worker process is managed by ShardingManager.
 * It handles the actual Discord Client connection, session resumption,
 * and event processing for a single bot token.
 */
async function runBot() {
    const env = getEnvPrefix();
    const token = process.env.DISCORD_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;

    if (!token) {
        console.error(`${env}[DiscordBot] ERROR: DISCORD_TOKEN not provided to bot process`);
        process.exit(1);
    }

    const stateRepo = new StreamerStateRepository();
    await stateRepo.init();

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    // To truly resume a session in discord.js, we should ideally use ShardingManager's
    // internal session handling. However, since we want persistence across restarts
    // and different environments, we use the SQLite database as the source of truth.
    
    // Note: We are NOT monkey-patching client.ws here because we are in a dedicated
    // process and we want to rely on the official library flow as much as possible.
    // discord.js manages the WebSocket connection internally.
    
    client.on('ready', async () => {
        try {
            const shard = (client.ws as any).shard;
            if (shard && shard.sessionInfo) {
                console.log(`${env}[DiscordBot] Capturing session info for bot ...${token.slice(-4)}`);
                await stateRepo.saveDiscordSession(token, {
                    sessionId: shard.sessionInfo.sessionId,
                    userSequence: shard.sessionInfo.sequence,
                    shardId: shard.sessionInfo.shardId,
                    shardCount: shard.sessionInfo.shardCount,
                    resumeURL: shard.sessionInfo.resumeURL
                });
            }
            console.log(`${env}[DiscordBot] Logged in as ${client.user?.tag}`);
        } catch (err) {
            console.error(`${env}[DiscordBot] Failed to save session info: ${err}`);
        }
    });

    // The worker can handle basic interactions, but most notification triggers
    // come from the main process via ShardingManager.broadcastEval or similar.
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        // Log mentions of the bot for observability
        if (message.mentions.has(client.user!)) {
            const channelName = (message.channel as any).name || 'Unknown';
            console.log(`${env}[Discord Chat] Bot mentioned by ${message.author.tag} in #${channelName}: ${message.content}`);
        }
    });

    try {
        await client.login(token);
    } catch (error) {
        console.error(`${env}[DiscordBot] Login failed: ${error}`);
        process.exit(1);
    }
}

runBot().catch(err => {
    console.error('[DiscordBot] Fatal error in worker process:', err);
    process.exit(1);
});
