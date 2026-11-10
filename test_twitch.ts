import { TwitchClient } from './src/clients/twitch.client';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        const twitch = new TwitchClient({
            clientId: process.env.TWITCH_CLIENT_ID || '',
            clientSecret: process.env.TWITCH_CLIENT_SECRET || ''
        });
        console.log('Fetching users for legitkorea...');
        const users = await twitch.getUsers(['legitkorea']);
        console.log('Users result:', JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error in test_twitch.ts:', e);
    }
})();
