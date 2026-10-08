import axios from 'axios';

export class WebhookNotifier {
  constructor(private webhookUrls: string[]) {}

  async notify(streamer: any): Promise<void> {
    const message = {
      text: `🔴 **${streamer.user_name}** is now LIVE!`,
      attachments: [
        {
          title: streamer.title,
          title_link: `https://twitch.tv/${streamer.user_login}`,
          image_url: streamer.thumbnail_url.replace('{width}', '400').replace('{height}', '225'),
          color: '#a970ff',
        },
      ],
    };

    const requests = this.webhookUrls.map((url) =>
      axios.post(url, message).catch((err) => 
        console.error(`Failed to send notification to ${url}:`, err.message)
      )
    );

    await Promise.all(requests);
  }
}
