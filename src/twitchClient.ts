import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class TwitchClient {
    private clientId = process.env.TWITCH_CLIENT_ID;
    private clientSecret = process.env.TWITCH_CLIENT_SECRET;
    private accessToken: string | null = null;

    async getAccessToken(): Promise<string> {
        if (this.accessToken) return this.accessToken;

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials',
                },
            });
            this.accessToken = response.data.access_token;
            return this.accessToken;
        } catch (error: any) {
            console.error('Error fetching Twitch access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Twitch');
        }
    }

    async getLiveStreamers(usernames: string[]): Promise<any[]> {
        const token = await this.getAccessToken();
        try {
            const response = await axios.get('https://api.twitch.tv/helix/streams', {
                params: {
                    user_login: usernames,
                },
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${token}`,
                },
            });
            return response.data.data;
        } catch (error: any) {
            console.error('Error fetching live streams:', error.response?.data || error.message);
            return [];
        }
    }
}
