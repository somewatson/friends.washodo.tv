import { DiscordNotifier } from '../src/services/discord.notifier';
import { StreamerStateRepository } from '../src/streamerStateRepository';
import dotenv from 'dotenv';

dotenv.config();

async function sendTestNotification() {
  try {
    const stateRepo = new StreamerStateRepository();
    await stateRepo.init();

    const discordNotifier = new DiscordNotifier(stateRepo);
    await discordNotifier.start();

    const testStreamer = {
      user_login: 'omegamixed',
      user_name: 'OmegaMixed',
      title: '🚀 TEST: Discord Integration Check! This is a test notification.',
    };

    console.log('Sending test notification to Discord...');
    await discordNotifier.notify(testStreamer, false);
    console.log('✅ Test notification sent successfully!');
    
    await discordNotifier.stop();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

sendTestNotification();
