import axios from 'axios';

interface ServerConfig {
  webhookToken: string;
  serverUrl: string;
  botToken: string;
  channelId: string;
}

export class MattermostNotifier {
  private servers: ServerConfig[] = [];

  constructor() {
    this.initializeServers();
  }

  private initializeServers(): void {
    const botsEnv = process.env.MATTERMOST_BOTS || '';
    const serverStrings = botsEnv.split(',').filter(Boolean);
    
    this.servers = serverStrings.map(str => {
      const [webhookToken, serverUrl, botToken, channelId] = str.split('|');
      if (!webhookToken || !serverUrl || !botToken || !channelId) {
        console.warn(`[MattermostNotifier] Invalid server config found: ${str}`);
        return null;
      }
      return { webhookToken, serverUrl, botToken, channelId };
    }).filter((s): s is ServerConfig => s !== null);
  }

  async notify(streamer: any, isRecurring: boolean = false): Promise<void> {
    if (this.servers.length === 0) {
      console.warn('[MattermostNotifier] No servers configured in MATTERMOST_BOTS');
      return;
    }

    const statusText = isRecurring ? 'is STILL LIVE!' : 'is now LIVE!';
    const prefix = isRecurring ? '🔔 *Reminder:* ' : '';

    const requests = this.servers.map(async (server) => {
      try {
        const baseUrl = process.env.BASE_URL || 'https://friends.washodo.tv';
        const thumbnail = `${baseUrl}/api/thumbnail/${streamer.user_login}`;
        
        await axios.post(`${server.serverUrl}/api/v4/posts`, {
          channel_id: server.channelId,
          message: `${prefix}🔴 **${streamer.user_name}** ${statusText}\n![Stream Thumbnail](${thumbnail})\nTitle: ${streamer.title}\nLink: https://twitch.tv/${streamer.user_login}`,
        }, {
          headers: { 'Authorization': `Bearer ${server.botToken}` }
        });
      } catch (error: any) {
        console.error(`[MattermostNotifier] Failed to notify ${server.serverUrl}:`, error.response?.data || error.message);
      }
    });

    await Promise.all(requests);
  }
}
