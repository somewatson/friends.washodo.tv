import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function debugProfilePic() {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('Missing Twitch credentials');
        process.exit(1);
    }

    try {
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials',
            },
        });
        const token = tokenResponse.data.access_token;

        const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
            params: {
                login: 'legitkorea',
            },
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`,
            },
        });

        const user = userResponse.data.data[0];
        if (user) {
            console.log('--- USER DATA ---');
            console.log(JSON.stringify(user, null, 2));
            console.log('--- END USER DATA ---');
        } else {
            console.error('User not found');
            process.exit(1);
        }
    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
        process.exit(1);
    }
}

debugProfilePic();
