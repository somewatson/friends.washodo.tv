import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testThumbnailNotification() {
  const botConfigStr = process.env.MATTERMOST_BOTS;
  if (!botConfigStr) {
    console.error('MATTERMOST_BOTS not found');
    process.exit(1);
  }

  const botStr = botConfigStr.split(',')[0]!;
  const [webhookToken, serverUrl, botToken, channelId] = botStr.split('|');
  
  const testStreamer = {
    user_name: 'Thumbnail Test',
    user_login: 'legitkorea',
    title: 'Testing the restored screenshots!',
  };

  const baseUrl = process.env.BASE_URL || 'https://friends.washodo.tv';
  const thumbnail = `${baseUrl}/api/thumbnail/${testStreamer.user_login}`;

  console.log(`Testing notification with thumbnail: ${thumbnail}`);

  try {
    await axios.post(`${serverUrl}/api/v4/posts`, {
      channel_id: channelId,
      message: `🔴 **Thumbnail Test** is now LIVE!\n![Stream Thumbnail](${thumbnail})\nTitle: ${testStreamer.title}\nLink: https://twitch.tv/${testStreamer.user_login}`,
    }, {
      headers: { 'Authorization': `Bearer ${botToken}` }
    });
    console.log('✅ Test notification sent successfully!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testThumbnailNotification().catch(console.error);
