import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function sendTestNotification() {
  const botsEnv = process.env.MATTERMOST_BOTS || '';
  const serverStrings = botsEnv.split(',').filter(Boolean);
  
  // Find the livingforge server configuration
  const livingForge = serverStrings
    .map(str => str.split('|'))
    .find(parts => parts[1] === 'https://livingforge.somewatson.com');

  if (!livingForge) {
    console.error('Could not find livingforge server configuration in MATTERMOST_BOTS');
    process.exit(1);
  }

  const [webhookToken, serverUrl, botToken, channelId] = livingForge;

  console.log(`Sending test notification to Living Forge (${serverUrl})...`);

  try {
    await axios.post(`${serverUrl}/api/v4/posts`, {
      channel_id: channelId,
      message: '🛠️ **Test Notification**\\nChecking the offline image for **LegitKorea**.\\n\\n[Click here to view the status page](https://friends.washodo.tv/status/legitkorea)',
    }, {
      headers: { 'Authorization': `Bearer ${botToken}` }
    });
    console.log('✅ Test notification sent successfully!');
  } catch (error: any) {
    console.error('❌ Failed to send notification:', error.response?.data || error.message);
    process.exit(1);
  }
}

sendTestNotification();
