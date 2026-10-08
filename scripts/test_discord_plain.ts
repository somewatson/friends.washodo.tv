import { DiscordNotifier } from '../src/services/discord.notifier';
import { StreamerStateRepository } from '../src/streamerStateRepository';
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

async function sendTestNotification() {
  try {
    const stateRepo = new StreamerStateRepository();
    await stateRepo.init();

    const discordNotifier = new DiscordNotifier(stateRepo);
    await discordNotifier.start();

    // We need to access the client to try a plain text send
    // Since the clients map is private, we'll use a a bit of a hack or just 
    // create a temporary client for this specific plain-text test
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    const token = process.env.DISCORD_BOTS?.split(',')[0]?.split('|')[0];
    const channelId = process.env.DISCORD_BOTS?.split(',')[0]?.split('|')[1];

    if (!token || !channelId) {
      throw new Error('DISCORD_BOTS not configured correctly in .env');
    }

    await client.login(token);
    const channel = await client.channels.fetch(channelId);
    
    console.log(`Testing plain text message to channel ${channelId}...`);
    await (channel as any).send('ping! This is a plain text test message.');
    console.log('✅ Plain text message sent successfully!');

    await client.destroy();
    await discordNotifier.stop();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

sendTestNotification();
