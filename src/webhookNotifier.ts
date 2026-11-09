import axios from 'axios';
import { getEnvPrefix } from './utils/env';

export class WebhookNotifier {
    private webhookUrls = process.env.WEBHOOK_URLS?.split(',').filter(Boolean) || [];
    private stateRepo: any;

    async sendMattermostTest(config: any) {
        try {
            await axios.post(`${config.server_url.replace(/\/$/, '')}/api/v4/posts`, {
                channel_id: config.channel_id,
                message: 'Test notification from Washodo Ward Admin Panel!',
            }, {
                headers: {
                    'Authorization': `Bearer ${config.bot_token}`,
                    'Content-Type': 'application/json',
                }
            });
            return true;
        } catch (error: any) {
            throw new Error(`Mattermost test failed: ${error.response?.data || error.message}`);
        }
    }

    async sendNotification(streamer: any, tier: string = 'Streamer', cachedThumbnail: string = '') {
        const mattermostConfigs = this.stateRepo ? await this.stateRepo.getMattermostConfigs() : [];
        
        if (this.webhookUrls.length === 0 && (!mattermostConfigs || mattermostConfigs.length === 0) && !process.env.MATTERMOST_BOTS) {
            console.error('No notification endpoints configured (webhooks or bots)');
            return;
        }
        
        const username = streamer.user_login;
        const baseUrl = process.env.BASE_URL || 'https://friends.washodo.tv';
        const thumbnail = `${baseUrl}/api/thumbnail/${username}`;
        
        const uptimeInfo = streamer.uptime ? `\n**${streamer.uptime}**` : '';
        const imageMarkdown = `![Stream Thumbnail](${thumbnail})\n`;
        const envPrefix = getEnvPrefix();
        const message = `${envPrefix}### 🔴 ${streamer.user_name} [${tier}] is LIVE!${uptimeInfo}\n${imageMarkdown}\n**Game:** ${streamer.game_name}\n**Title:** ${streamer.title}\n\n[Watch Now](https://twitch.tv/${streamer.user_login})\n[View all streamers](${baseUrl}/)\n\nVisit our website: https://friends.washodo.tv`;

        const notifications: Promise<any>[] = [];

        // 1. Standard Webhooks
        if (this.webhookUrls.length > 0) {
            notifications.push(...this.webhookUrls.map(async (url) => {
                try {
                    await axios.post(url, { text: message });
                    console.log(`Notification sent to webhook ${url} for ${streamer.user_name}`);
                } catch (error: any) {
                    console.error(`Error sending to webhook ${url}:`, error.response?.data || error.message);
                }
            }));
        }

        // 2. Mattermost Bots (DB Preferred, then Env Fallback)
        const bots = [];
        if (mattermostConfigs && mattermostConfigs.length > 0) {
            bots.push(...mattermostConfigs.map((cfg: any) => ({
                token: cfg.bot_token,
                url: cfg.server_url,
                channelId: cfg.channel_id
            })));
        } else {
            const botConfigsEnv = process.env.MATTERMOST_BOTS?.split(',').filter(Boolean) || [];
            botConfigsEnv.forEach(config => {
                const [token, url, botToken, channelId] = config.split('|');
                // Note: MattermostNotifier.ts uses webhookToken|serverUrl|botToken|channelId
                // The old WebhookNotifier.ts expected token|url|channelId.
                // We should normalize this to match the actual DB/Notifier format.
                if (token && url && channelId) {
                    bots.push({ token: botToken || token, url, channelId });
                }
            });
        }

        if (bots.length > 0) {
            notifications.push(...bots.map(async (bot) => {
                try {
                    await axios.post(`${bot.url.replace(/\/$/, '')}/api/v4/posts`, {
                        channel_id: bot.channelId,
                        message: message,
                    }, {
                        headers: {
                            'Authorization': `Bearer ${bot.token}`,
                            'Content-Type': 'application/json',
                        }
                    });
                    console.log(`Notification sent to Mattermost bot at ${bot.url} for ${streamer.user_name}`);
                } catch (error: any) {
                    console.error(`Error sending to Mattermost bot at ${bot.url}:`, error.response?.data || error.message);
                }
            }));
        }

        await Promise.allSettled(notifications);
    }
}
