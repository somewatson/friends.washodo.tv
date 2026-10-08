import express from 'express';
import bodyParser from 'body-parser';
import { WebhookNotifier } from '../services/webhook.service';
import { TwitchClient } from '../clients/twitch.client';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

interface ServerConfig {
  webhookToken: string;
  serverUrl: string;
  botToken: string;
}

export class InteractiveReceiver {
  private app: express.Application;
  private notifier: WebhookNotifier;
  private twitchClient: TwitchClient;
  private servers: Map<string, ServerConfig> = new Map();

  constructor(notifier: WebhookNotifier, twitchClient: TwitchClient) {
    this.app = express();
    this.notifier = notifier;
    this.twitchClient = twitchClient;
    
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(express.json());

    this.initializeServers();
    this.setupRoutes();
  }

  private initializeServers(): void {
    const botsEnv = process.env.MATTERMOST_BOTS || '';
    const serverStrings = botsEnv.split(',').filter(Boolean);
    
    serverStrings.forEach(str => {
      const [webhookToken, serverUrl, botToken] = str.split('|');
      if (webhookToken && serverUrl && botToken) {
        this.servers.set(webhookToken, { webhookToken, serverUrl, botToken });
        console.log(`[Receiver] Configured server: ${serverUrl}`);
      } else {
        console.warn(`[Receiver] Invalid server config found: ${str}`);
      }
    });
  }

  private setupRoutes(): void {
    this.app.post('/mattermost/webhook', async (req, res) => {
      const { token, text, channel_id, user_name } = req.body as any;

      // Look up server config by the incoming webhook token
      const serverConfig = this.servers.get(token);

      if (!serverConfig) {
        console.error(`[Security] Unauthorized webhook attempt from ${req.ip} with token ${token}`);
        return res.status(401).send('Unauthorized');
      }

      console.log(`[Webhook] Received message from ${user_name} on ${serverConfig.serverUrl}: ${text}`);

      try {
        await this.handleCommand(text, channel_id, serverConfig);
        res.status(200).send('OK');
      } catch (error) {
        console.error('[Receiver] Error handling command:', error);
        res.status(500).send('Internal Server Error');
      }
    });
  }

  private async handleCommand(text: string, channelId: string, serverConfig: ServerConfig): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const parts = trimmedText.split(/\s+/);
    const command = parts[0] ? parts[0].toLowerCase() : '';
    const args = parts.slice(1);

    if (command === '!help') {
      await this.sendResponse(channelId, '🤖 **Bot Help Menu**\n- `!status`: Check current monitoring status\n- `!streamers`: Show all tracked streamers and their status\n- `!check <username>`: Check a specific streamer\n- `!schedule`: View the current stream schedule\n- `!help`: Show this menu', serverConfig);
    } else if (command === '!status') {
      await this.sendResponse(channelId, '✅ Bot is active and monitoring streamers!', serverConfig);
    } else if (command === '!schedule') {
      const schedule = process.env.BOT_SCHEDULE_TEXT || 'No schedule configured.';
      await this.sendResponse(channelId, `📅 **Current Schedule**\n${schedule}`, serverConfig);
    } else if (command === '!streamers') {
      await this.handleListStreamers(channelId, serverConfig);
    } else if (command === '!check') {
      if (args.length === 0) {
        await this.sendResponse(channelId, '❌ Please provide a username. Usage: `!check <username>`', serverConfig);
        return;
      }
      await this.handleCheckStreamer(args[0] || '', channelId, serverConfig);
    } else {
      await this.sendResponse(channelId, `I heard you say "${text}", but I don't know that command. Try \`!help\`.`, serverConfig);
    }
  }

  private async handleListStreamers(channelId: string, serverConfig: ServerConfig): Promise<void> {
    const trackedStreamers = (process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean);
    if (trackedStreamers.length === 0) {
      await this.sendResponse(channelId, 'No streamers are currently being tracked.', serverConfig);
      return;
    }

    try {
      const liveStreams = await this.twitchClient.getStreamStatus(trackedStreamers);
      const liveUsernames = liveStreams.map((s: any) => s.user_login.toLowerCase());
      
      let response = '👥 **Tracked Streamers**\n';
      trackedStreamers.forEach(user => {
        const isLive = liveUsernames.includes(user.toLowerCase());
        const status = isLive ? '🔴 Live' : '⚪ Offline';
        response += `- ${user}: ${status}\n`;
      });

      await this.sendResponse(channelId, response.trim(), serverConfig);
    } catch (error) {
      console.error('[Receiver] Error listing streamers:', error);
      await this.sendResponse(channelId, '❌ Error fetching streamer statuses.', serverConfig);
    }
  }

  private async handleCheckStreamer(username: string, channelId: string, serverConfig: ServerConfig): Promise<void> {
    try {
      const liveStreams = await this.twitchClient.getStreamStatus([username]);
      const stream = liveStreams[0];

      if (stream) {
        await this.sendResponse(channelId, `🔴 **${stream.user_name}** is currently LIVE!\nTitle: ${stream.title}\nLink: https://twitch.tv/${stream.user_login}`, serverConfig);
      } else {
        await this.sendResponse(channelId, `⚪ **${username}** is currently offline.`, serverConfig);
      }
    } catch (error) {
      console.error('[Receiver] Error checking streamer:', error);
      await this.sendResponse(channelId, `❌ Error checking status for ${username}.`, serverConfig);
    }
  }

  private async sendResponse(channelId: string, message: string, serverConfig: ServerConfig): Promise<void> {
    try {
      await axios.post(`${serverConfig.serverUrl}/api/v4/posts`, {
        channel_id: channelId,
        message: message,
      }, {
        headers: { 'Authorization': `Bearer ${serverConfig.botToken}` }
      });
    } catch (error: any) {
      console.error(`[Receiver] Failed to send response to ${serverConfig.serverUrl}:`, error.response?.data || error.message);
    }
  }

  public listen(port: number): void {
    this.app.listen(port, () => {
      const baseUrl = process.env.BASE_URL || 'http://localhost';
      console.log(`🚀 Mattermost Outgoing Webhook ready at: ${baseUrl}/mattermost/webhook`);
    });
  }
}
