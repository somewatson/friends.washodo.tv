import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface TwitchConfig {
  clientId: string;
  clientSecret: string;
}

export class TwitchClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private config: TwitchConfig) {}

  async getAccessToken(): Promise<string> {
    return this.fetchAccessToken();
  }

  private async fetchAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials',
        },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000; // Buffer of 1 minute
      return this.accessToken as string;
    } catch (error: any) {
      console.error('Error fetching Twitch access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Twitch');
    }
  }

  async getUsers(usernames: string[]): Promise<any[]> {
    const token = await this.fetchAccessToken();
    try {
      const response = await axios.get('https://api.twitch.tv/helix/users', {
        params: {
          login: usernames,
        },
        headers: {
          'Client-ID': this.config.clientId,
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
    const token = await this.fetchAccessToken();
    try {
      const response = await axios.get('https://api.twitch.tv/helix/streams', {
        params: {
          user_login: usernames,
        },
        headers: {
          'Client-ID': this.config.clientId,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const streams = response.data.data;
      if (!streams || streams.length === 0) return [];

      const userIds = streams.map((s: any) => s.user_id);
      const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
        params: {
          id: userIds,
        },
        headers: {
          'Client-ID': this.config.clientId,
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

  async getStreamStatus(usernames: string[]): Promise<any[]> {
    return this.getLiveStreamers(usernames);
  }

  async searchUsers(query: string): Promise<any[]> {
    if (!query) return [];
    const token = await this.fetchAccessToken();
    try {
      // Using the search endpoint instead of users endpoint for partial matches
      const response = await axios.get('https://api.twitch.tv/helix/search', {
        params: {
          query: query,
          type: 'user',
          first: 20,
        },
        headers: {
          'Client-ID': this.config.clientId,
          'Authorization': `Bearer ${token}`,
        },
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Error searching Twitch users:', error.response?.data || error.message);
      return [];
    }
  }
}
