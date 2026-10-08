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
      const { token, text, channel_id, root_id, user_name } = req.body as any;

      // Look up server config by the incoming webhook token
      const serverConfig = this.servers.get(token);

      if (!serverConfig) {
        console.error(`[Security] Unauthorized webhook attempt from ${req.ip} with token ${token}`);
        return res.status(401).send('Unauthorized');
      }

      console.log(`[Webhook] Received message from ${user_name} on ${serverConfig.serverUrl}: ${text}`);

      try {
        await this.handleCommand(text, channel_id, serverConfig, root_id);
        res.status(200).send('OK');
      } catch (error) {
        console.error('[Receiver] Error handling command:', error);
        res.status(500).send('Internal Server Error');
      }
    });
  }

  private async handleCommand(text: string, channelId: string, serverConfig: ServerConfig, rootId?: string): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Truth-confirming logic: Check for "true" and "?" (case-insensitive)
    const lowerText = trimmedText.toLowerCase();
    if (lowerText.includes('true') && lowerText.includes('?')) {
      await this.sendResponse(channelId, 'Of course, that sounds about right!', serverConfig, rootId);
      return;
    }

    const parts = trimmedText.split(/\s+/);
    const lowerParts = parts.map(p => p.toLowerCase());

    // 1. Define recognized command keywords (without prefix)
    const commandKeywords = ['help', 'status', 'streamers', 'check', 'schedule'];
    
    // 2. Verify if the bot was actually triggered/mentioned (starts with ! or @)
    const hasTrigger = parts.some(p => p.startsWith('!') || p.startsWith('@'));
    if (!hasTrigger) return;

    // 3. Find the first word that matches a known command (with or without !)
    let commandIndex = -1;
    let matchedKeyword = '';

    for (let i = 0; i < lowerParts.length; i++) {
      const word = lowerParts[i];
      if (!word) continue;
      const cleanWord = word.startsWith('!') ? word.slice(1) : word;
      
      if (commandKeywords.includes(cleanWord)) {
        commandIndex = i;
        matchedKeyword = cleanWord;
        break;
      }
    }

    if (commandIndex === -1) {
      // No recognized command found, but bot was mentioned.
      // Only reply if the first word was a trigger to avoid spamming.
      if (parts[0]?.startsWith('!') || parts[0]?.startsWith('@')) {
        await this.sendResponse(channelId, `I heard you mention me, but I don't recognize a command. Try \`!help\`.`, serverConfig, rootId);
      }
      return;
    }

    // 4. Determine the final command string and arguments
    const command = `!${matchedKeyword}`;
    const args = parts.slice(commandIndex + 1);

    if (command === '!help') {
      await this.sendResponse(channelId, '🤖 **Bot Help Menu**\n- `!status`: Check current monitoring status\n- `!streamers`: Show all tracked streamers and their status\n- `!check <username>`: Check a specific streamer\n- `!schedule`: View the current stream schedule\n- `!help`: Show this menu', serverConfig, rootId);
    } else if (command === '!status') {
      await this.sendResponse(channelId, '✅ Bot is active and monitoring streamers!', serverConfig, rootId);
    } else if (command === '!schedule') {
      const schedule = process.env.BOT_SCHEDULE_TEXT || 'No schedule configured.';
      await this.sendResponse(channelId, `📅 **Current Schedule**\n${schedule}`, serverConfig, rootId);
    } else if (command === '!streamers') {
      await this.handleListStreamers(channelId, serverConfig, rootId);
    } else if (command === '!check') {
      if (args.length === 0) {
        await this.sendResponse(channelId, '❌ Please provide a username. Usage: `!check <username>`', serverConfig, rootId);
        return;
      }
      await this.handleCheckStreamer(args[0] || '', channelId, serverConfig, rootId);
    }
  }

  private async handleListStreamers(channelId: string, serverConfig: ServerConfig, rootId?: string): Promise<void> {
    const members = (process.env.WASHODO_MEMBERS || '').split(',').filter(Boolean);
    const friends = (process.env.WASHODO_FRIENDS || '').split(',').filter(Boolean);
    const others = (process.env.TRACKED_STREAMERS || '').split(',').filter(Boolean);

    const allStreamers = [...new Set([...members, ...friends, ...others])];

    if (allStreamers.length === 0) {
      await this.sendResponse(channelId, 'No streamers are currently being tracked.', serverConfig);
      return;
    }

    try {
      const liveStreams = await this.twitchClient.getStreamStatus(allStreamers);
      const liveUsernames = liveStreams.map((s: any) => s.user_login.toLowerCase());
      
      let response = '👥 **Tracked Streamers**\n';
      
      const formatGroup = (title: string, list: string[]) => {
        if (list.length === 0) return '';
        let groupText = `\n**${title}**\n`;
        list.forEach(user => {
          const isLive = liveUsernames.includes(user.toLowerCase());
          const status = isLive ? '🔴 Live' : '⚪ Offline';
          groupText += `- ${user}: ${status}\n`;
        });
        return groupText;
      };

      response += formatGroup('Members', members);
      response += formatGroup('Friends', friends);
      response += formatGroup('Other', others);

      await this.sendResponse(channelId, response.trim(), serverConfig, rootId);
    } catch (error) {
      console.error('[Receiver] Error listing streamers:', error);
      await this.sendResponse(channelId, '❌ Error fetching streamer statuses.', serverConfig, rootId);
    }
  }

  private async handleCheckStreamer(username: string, channelId: string, serverConfig: ServerConfig, rootId?: string): Promise<void> {
    try {
      const liveStreams = await this.twitchClient.getStreamStatus([username]);
      const stream = liveStreams[0];

      if (stream) {
        await this.sendResponse(channelId, `🔴 **${stream.user_name}** is currently LIVE!\nTitle: ${stream.title}\nLink: https://twitch.tv/${stream.user_login}`, serverConfig, rootId);
      } else {
        await this.sendResponse(channelId, `⚪ **${username}** is currently offline.`, serverConfig, rootId);
      }
    } catch (error) {
      console.error('[Receiver] Error checking streamer:', error);
      await this.sendResponse(channelId, `❌ Error checking status for ${username}.`, serverConfig, rootId);
    }
  }

  private async sendResponse(channelId: string, message: string, serverConfig: ServerConfig, rootId?: string): Promise<void> {
    const websiteUrl = 'https://friends.washodo.tv';
    const promotionalMessage = `\n\n🌐 Check out the status page: ${websiteUrl}`;
    const finalMessage = message + promotionalMessage;

    try {
      await axios.post(`${serverConfig.serverUrl}/api/v4/posts`, {
        channel_id: channelId,
        root_id: rootId,
        message: finalMessage,
      }, {
        headers: { 'Authorization': `Bearer ${serverConfig.botToken}` }
      });
    } catch (error: any) {
      console.error(`[Receiver] Failed to send response to ${serverConfig.serverUrl}:`, error.response?.data || error.message);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public listen(port: number): void {
    this.app.listen(port, () => {
      const baseUrl = process.env.BASE_URL || 'http://localhost';
      console.log(`🚀 Mattermost Outgoing Webhook ready at: ${baseUrl}/mattermost/webhook`);
    });
  }
}
