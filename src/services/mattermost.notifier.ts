import axios from 'axios';
import { withRetry, LogThrottler } from '../utils/resilience';

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

    // Process servers sequentially to avoid unbounded concurrency and DB pressure
    for (const server of this.servers) {
      try {
        const cooldown = isRecurring 
          ? (parseInt(process.env.RECURRING_NOTIFICATION_MINUTES || '180')) 
          : 0;

        const shouldNotify = await this.stateRepo.shouldNotify(
          streamer.user_login, 
          'mattermost', 
          server.channelId, 
          cooldown
        );

        if (!shouldNotify) continue;

        const message = `${prefix}🔴 **${streamer.user_name}** ${statusText}\n${thumbnail ? `![Stream Thumbnail](${thumbnail})\n` : ''}Title: ${streamer.title}\nLink: https://twitch.tv/${streamer.user_login}`;

        await withRetry(
          () => axios.post(`${server.serverUrl}/api/v4/posts`, {
            channel_id: server.channelId,
            message: message,
          }, {
            headers: { 'Authorization': `Bearer ${server.botToken}` },
            timeout: 10000 // 10s timeout
          }),
          3,
          1000,
          (err, attempt) => console.log(`[MattermostNotifier] Retry ${attempt} for ${server.serverUrl} due to: ${err.message}`)
        );

        await this.stateRepo.recordNotification(streamer.user_login, 'mattermost', server.channelId);
      } catch (error: any) {
        const logKey = `mattermost_error_${server.serverUrl}`;
        if (LogThrottler.shouldLog(logKey)) {
          console.error(`[MattermostNotifier] Persistent failure for ${server.serverUrl}:`, error.response?.data || error.message);
        }
      }
    }
  }
}
