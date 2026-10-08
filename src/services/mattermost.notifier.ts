import axios from 'axios';

interface ServerConfig {
  webhookToken: string;
  serverUrl: string;
  botToken: string;
  channelId: string;
}

export class MattermostNotifier {
  private servers: ServerConfig[] = [];
  private stateRepo: any;

  constructor(stateRepo: any) {
    this.stateRepo = stateRepo;
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

    const thumbnail = streamer.thumbnail_url 
      ? streamer.thumbnail_url.replace('{width}', '400').replace('{height}', '225') 
      : '';

    const requests = this.servers.map(async (server) => {
      try {
        // 1. Check if we should notify this specific channel
        const shouldNotify = await this.stateRepo.shouldNotify(
          streamer.user_login, 
          'mattermost', 
          server.channelId, 
          isRecurring ? 60 : 0
        );

        if (!shouldNotify) return;

        const message = `${prefix}🔴 **${streamer.user_name}** ${statusText}\n${thumbnail ? `![Stream Thumbnail](${thumbnail})\n` : ''}Title: ${streamer.title}\nLink: https://twitch.tv/${streamer.user_login}`;

        await axios.post(`${server.serverUrl}/api/v4/posts`, {
          channel_id: server.channelId,
          message: message,
        }, {
          headers: { 'Authorization': `Bearer ${server.botToken}` }
        });

        // 2. Confirm delivery in DB
        await this.stateRepo.recordNotification(streamer.user_login, 'mattermost', server.channelId);
      } catch (error: any) {
        console.error(`[MattermostNotifier] Failed to notify ${server.serverUrl}:`, error.response?.data || error.message);
      }
    });

    await Promise.all(requests);
  }
}
