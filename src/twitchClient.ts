import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class TwitchClient {
    private clientId = process.env.TWITCH_CLIENT_ID;
    private clientSecret = process.env.TWITCH_CLIENT_SECRET;
    private accessToken: string | null = null;

    async getAccessToken(): Promise<string> {
        if (this.accessToken) return this.accessToken;

        if (!this.clientId || !this.clientSecret) {
            console.warn('⚠️ Twitch credentials missing. API will be in limited mode.');
            return 'dummy-token';
        }

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials',
                },
            });
            this.accessToken = response.data.access_token;
            if (!this.accessToken) throw new Error('Twitch API did not return an access token');
            return this.accessToken;
        } catch (error: any) {
            console.error('Error fetching Twitch access token:', error.response?.data || error.message);
            // Fallback to dummy token to allow API to start even without credentials
            return 'dummy-token';
        }
    }

    async getUsers(usernames: string[]): Promise<any[]> {
        const token = await this.getAccessToken();
        try {
            const response = await axios.get('https://api.twitch.tv/helix/users', {
                params: {
                    login: usernames,
                },
                headers: {
                    'Client-ID': this.clientId || 'dummy-id',
                    'Authorization': `Bearer ${token}`,
                },
            });
            return response.data.data;
        } catch (error: any) {
            console.error('Error fetching Twitch users:', error.response?.data || error.message);
            return [];
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
                    'Client-ID': this.clientId || 'dummy-id',
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            const streams = response.data.data;
            if (!streams || streams.length === 0) return [];

            // The /streams endpoint provides stream info (title, thumbnail) but NOT user info (profile image).
            // We need to fetch user info for those who are live to get their profile pictures.
            const userIds = streams.map((s: any) => s.user_id);
            const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
                params: {
                    id: userIds,
                },
                headers: {
                    'Client-ID': this.clientId || 'dummy-id',
                    'Authorization': `Bearer ${token}`,
                },
            });

            const users = userResponse.data.data;
            const userMap: Record<string, any> = {};
            users.forEach((u: any) => {
                userMap[u.id] = u;
            });

            return streams.map((s: any) => ({
                ...s,
                profile_image_url: userMap[s.user_id]?.profile_image_url || '',
                displayName: userMap[s.user_id]?.display_name || s.user_login
            }));
        } catch (error: any) {
            console.error('Error fetching live streams:', error.response?.data || error.message);
            return [];
        }
    }

    async getStreamStartTime(userId: string): Promise<string | null> {
        const token = await this.getAccessToken();
        try {
            const response = await axios.get('https://api.twitch.tv/helix/videos', {
                params: {
                    user_id: userId,
                    type: 'live',
                },
                headers: {
                    'Client-ID': this.clientId || 'dummy-id',
                    'Authorization': `Bearer ${token}`,
                },
            });
            const videos = response.data.data;
            if (videos && videos.length > 0) {
                return videos[0].created_at;
            }
            return null;
        } catch (error: any) {
            console.error(`Error fetching start time for user ${userId}:`, error.response?.data || error.message);
            return null;
        }
    }
}
