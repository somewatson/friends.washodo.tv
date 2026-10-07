import axios from 'axios';

export class WebhookNotifier {
    private webhookUrls = process.env.WEBHOOK_URLS?.split(',').filter(Boolean) || [];

    async sendNotification(streamer: any, tier: string = 'Streamer') {
        if (this.webhookUrls.length === 0 && !process.env.MATTERMOST_BOTS) {
            console.error('No notification endpoints configured (webhooks or bots)');
            return;
        }

        const thumbnail = streamer.thumbnail_url 
            ? streamer.thumbnail_url.replace('{width}', '400').replace('{height}', '225') 
            : '';
        const uptimeInfo = streamer.uptime ? `\n**${streamer.uptime}**` : '';
        const imageMarkdown = thumbnail ? `![Stream Thumbnail](${thumbnail})\n` : '';
        const message = `### 🔴 ${streamer.user_name} [${tier}] is LIVE!${uptimeInfo}\n${imageMarkdown}\n**Game:** ${streamer.game_name}\n**Title:** ${streamer.title}\n\n[Watch Now](https://twitch.tv/${streamer.user_login})\n[View all streamers](https://friends.washodo.tv/)`;

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

        // 2. Mattermost Bots
        const botConfigs = process.env.MATTERMOST_BOTS?.split(',').filter(Boolean) || [];
        if (botConfigs.length > 0) {
            notifications.push(...botConfigs.map(async (config) => {
                const [token, url, channelId] = config.split('|');
                if (!token || !url || !channelId) {
                    console.error(`Invalid Mattermost bot config: ${config}. Expected token|url|channelId`);
                    return;
                }

                try {
                    await axios.post(`${url.replace(/\/$/, '')}/api/v4/posts`, {
                        channel_id: channelId,
                        message: message,
                    }, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        }
                    });
                    console.log(`Notification sent to Mattermost bot at ${url} for ${streamer.user_name}`);
                } catch (error: any) {
                    console.error(`Error sending to Mattermost bot at ${url}:`, error.response?.data || error.message);
                }
            }));
        }

        await Promise.allSettled(notifications);
    }
}
