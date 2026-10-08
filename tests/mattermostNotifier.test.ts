import { MattermostNotifier } from '../src/mattermostNotifier';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MattermostNotifier', () => {
    let notifier: MattermostNotifier;

    beforeEach(() => {
        process.env.MATTERMOST_WEBHOOK_URL = 'http://test-webhook.com';
        notifier = new MattermostNotifier();
        jest.clearAllMocks();
    });

    it('should send notification to Mattermost', async () => {
        const mockStreamer = {
            user_name: 'Streamer One',
            user_login: 'streamer1',
            game_name: 'Just Chatting',
            title: 'Welcome to the stream!'
        };
        
        mockedAxios.post.mockResolvedValueOnce({ data: {} });
        
        await notifier.sendNotification(mockStreamer);
        
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-webhook.com',
            expect.objectContaining({
                text: expect.stringContaining('Streamer One [Streamer] is LIVE!')
            })
        );
    });

    it('should not send notification if webhook URL is missing', async () => {
        // Clear environment variable for this test
        delete process.env.MATTERMOST_WEBHOOK_URL;
        
        // We need to create a NEW notifier instance because the webhookUrl 
        // is assigned in the constructor/property initialization
        const notifierNoWebhook = new MattermostNotifier();
        const mockStreamer = { user_name: 'test' };
        
        await notifierNoWebhook.sendNotification(mockStreamer);
        
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });
});
