import { TwitchClient } from './src/twitchClient.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        const twitch = new TwitchClient();
        const users = await twitch.getUsers(['legitkorea']);
        console.log(JSON.stringify(users[0], null, 2));
    } catch (e) {
        console.error(e);
    }
})();
