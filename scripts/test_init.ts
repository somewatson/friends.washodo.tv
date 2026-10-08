import { StreamerStateRepository } from '../src/streamerStateRepository';
import { ApiServer } from '../src/server';
import { InteractiveReceiver } from '../src/services/interactive.receiver';
import { MattermostNotifier } from '../src/services/mattermost.notifier';
import { TwitchClient } from '../src/clients/twitch.client';

async function testInit() {
  try {
    const stateRepo = new StreamerStateRepository();
    await stateRepo.init();
    console.log('✅ stateRepo.init() successful');
    
    // This is what was crashing
    await stateRepo.isKnownLive('testuser');
    console.log('✅ isKnownLive() successful');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testInit().catch(console.error);
