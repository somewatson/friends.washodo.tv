import axios from 'axios';

export class UmamiAnalytics {
    private static websiteId = 'cf5643bb-9645-4789-b5fd-a03e9944cf75';
    private static endpoint = 'https://gateway.umami.is/api/send';

    static async trackEvent(eventName: string, eventData: Record<string, any> = {}) {
        try {
            await axios.post(this.endpoint, {
                payload: {
                    hostname: 'friends.washodo.tv',
                    language: 'en-US',
                    referrer: '',
                    screen: '1920x1080',
                    title: 'Washodo Ward Admin',
                    url: '/admin',
                    website: this.websiteId,
                    name: eventName,
                    data: eventData,
                },
                type: 'event',
            }, {
                headers: {
                    'User-Agent': 'WashodoWard-Backend/1.0',
                },
            });
        } catch (error) {
            console.error('[Umami] Failed to track event:', error);
        }
    }
}