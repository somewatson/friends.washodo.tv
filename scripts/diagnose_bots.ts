import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function runDiagnostics() {
  const botConfigStr = process.env.MATTERMOST_BOTS;
  if (!botConfigStr) {
    console.error('MATTERMOST_BOTS not found in .env');
    process.exit(1);
  }

  const bots = botConfigStr.split(',').filter(Boolean);
  
  console.log(`Testing ${bots.length} bot configurations...\n`);

  for (const botStr of bots) {
    const [webhookToken, serverUrl, botToken, channelId] = botStr.split('|');
    console.log(`--- Testing Bot on ${serverUrl} ---`);
    console.log(`Channel ID: ${channelId}`);

    try {
      // 1. Test Identity/Auth
      const authResponse = await axios.get(`${serverUrl}/api/v4/users/me`, {
        headers: { 'Authorization': `Bearer ${botToken}` }
      });
      console.log(`✅ Auth Successful: Bot is ${authResponse.data.username}`);

      // 2. Test Posting to the specific channel
      const postResponse = await axios.post(`${serverUrl}/api/v4/posts`, {
        channel_id: channelId,
        message: `🔔 **Notification Test**: Bot is online and authenticated!`,
      }, {
        headers: { 'Authorization': `Bearer ${botToken}` }
      });
      console.log(`✅ Post Successful: Message ID ${postResponse.data.id}`);

    } catch (error: any) {
      if (error.response) {
        console.error(`❌ Failed: ${error.response.status}`);
        console.error(`Response:`, JSON.stringify(error.response.data));
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    }
    console.log('\n');
  }
}

runDiagnostics().catch(console.error);
