import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function runDeepDiagnostics() {
  const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
  const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
  const tracked = [...new Set([...members, ...friends])];

  console.log(`Checking ${tracked.length} streamers...`);

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing Twitch credentials in .env');
    process.exit(1);
  }

  try {
    const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      },
    });
    const token = tokenRes.data.access_token;

    const liveRes = await axios.get('https://api.twitch.tv/helix/streams', {
      params: { user_login: tracked },
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
      },
    });

    const liveUsernames = liveRes.data.data.map((s: any) => s.user_login);
    console.log(`Live streamers found: ${liveUsernames.join(', ') || 'None'}`);
    
    for (const user of tracked) {
       if (liveUsernames.includes(user)) {
         console.log(`✅ ${user} is actually LIVE.`);
       } else {
         console.log(`⚪ ${user} is offline.`);
       }
    }
  } catch (e: any) {
    console.error(`Twitch API Error: ${e.message}`);
    process.exit(1);
  }
}

runDeepDiagnostics().catch(console.error);
