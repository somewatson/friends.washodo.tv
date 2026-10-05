import axios from 'axios';

export class MattermostNotifier {
    private webhookUrl = process.env.MATTERMOST_WEBHOOK_URL;

    async sendNotification(streamer: any) {
        if (!this.webhookUrl) {
            console.error('Mattermost Webhook URL not configured');
            return;
        }

        const message = `### 🔴 ${streamer.user_name} is LIVE!\n\n**Game:** ${streamer.game_name}\n**Title:** ${streamer.title}\n\n[Watch Now](https://twitch.tv/${streamer.user_login})`;

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
