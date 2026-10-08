import { WebhookNotifier } from '../src/webhookNotifier';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookNotifier', () => {
    let notifier: WebhookNotifier;

    beforeEach(() => {
        process.env.WEBHOOK_URLS = 'http://test-webhook1.com,http://test-webhook2.com';
        notifier = new WebhookNotifier();
        jest.clearAllMocks();
    });

    it('should send notification to all configured webhooks', async () => {
        const mockStreamer = {
            user_name: 'Streamer One',
            user_login: 'streamer1',
            game_name: 'Just Chatting',
            title: 'Welcome to the stream!'
        };
        
        mockedAxios.post.mockResolvedValue({ data: {} });
        
        await notifier.sendNotification(mockStreamer);
        
        expect(mockedAxios.post).toHaveBeenCalledTimes(2);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-webhook1.com',
            expect.objectContaining({
                text: expect.stringContaining('Streamer One is LIVE!')
            })
        );
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-webhook2.com',
            expect.objectContaining({
                text: expect.stringContaining('Streamer One is LIVE!')
            })
        );
    });

    it('should not send notification if webhook URLs are missing', async () => {
        delete process.env.WEBHOOK_URLS;
        
        const notifierNoWebhook = new WebhookNotifier();
        const mockStreamer = { user_name: 'test' };
        
        await notifierNoWebhook.sendNotification(mockStreamer);
        
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });
});
