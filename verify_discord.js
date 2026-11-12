require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function verifyDiscordLogin() {
    try {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            console.error('❌ DISCORD_BOT_TOKEN not found in environment');
            process.exit(1);
        }

        console.log('Attempting to login with token: ' + token.substring(0, 10) + '...');
        
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        await client.login(token);
        console.log('✅ Login successful! Bot is: ' + client.user.tag);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Login failed:');
        console.error(error);
        process.exit(1);
    }
}

verifyDiscordLogin();
