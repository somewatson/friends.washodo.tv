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

  async getStreamStatus(usernames: string[]): Promise<any[]> {
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
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching stream status:', error.response?.data || error.message);
      return [];
    }
  }
}
