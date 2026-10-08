import axios from 'axios';

export class MattermostNotifier {
    private webhookUrl = process.env.MATTERMOST_WEBHOOK_URL;

    async sendNotification(streamer: any, tier: string = 'Streamer') {
        if (!this.webhookUrl) {
            console.error('Mattermost Webhook URL not configured');
            return;
        }

        const message = `### 🔴 ${streamer.user_name} [${tier}] is LIVE!\n\n**Game:** ${streamer.game_name}\n**Title:** ${streamer.title}\n\n[Watch Now](https://twitch.tv/${streamer.user_login})\n\n[Check all streamer statuses](https://friends.washodo.tv)`;

        try {
            await axios.post(this.webhookUrl, {
                text: message,
            });
            console.log(`Notification sent for ${streamer.user_name}`);
        } catch (error: any) {
            console.error('Error sending Mattermost notification:', error.response?.data || error.message);
        }
    }
}
