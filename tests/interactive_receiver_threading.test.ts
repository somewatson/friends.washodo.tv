import axios from 'axios';
import { InteractiveReceiver } from '../src/services/interactive.receiver';
import { TwitchClient } from '../src/clients/twitch.client';
import { WebhookNotifier } from '../src/services/webhook.service';
import request from 'supertest';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InteractiveReceiver Threading', () => {
    let receiver: InteractiveReceiver;
    let app: any;
    let mockTwitchClient: TwitchClient;
    let mockWebhookNotifier: WebhookNotifier;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock dependencies
        mockTwitchClient = {} as TwitchClient;
        mockWebhookNotifier = {} as WebhookNotifier;

        // Configure environment for a test server
        process.env.MATTERMOST_BOTS = 'test-token|http://test-server.com|test-bot-token';
        
        receiver = new InteractiveReceiver(mockWebhookNotifier, mockTwitchClient);
        app = receiver.getApp();
    });

    it('should include root_id in the response to Mattermost when provided in the webhook', async () => {
        const testRootId = 'root_12345';
        const testChannelId = 'channel_abc';
        
        mockedAxios.post.mockResolvedValueOnce({ data: {} });

        const response = await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'test-token',
                text: '!status',
                channel_id: testChannelId,
                root_id: testRootId,
                user_name: 'testuser'
            });

        expect(response.status).toBe(200);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-server.com/api/v4/posts',
            expect.objectContaining({
                channel_id: testChannelId,
                root_id: testRootId,
                message: expect.stringContaining('Bot is active')
            }),
            expect.objectContaining({
                headers: { 'Authorization': 'Bearer test-bot-token' }
            })
        );
    });

    it('should handle root_id correctly for !streamers command', async () => {
        const testRootId = 'root_67890';
        const testChannelId = 'channel_xyz';
        
        // Mock TwitchClient to return a live streamer
        (mockTwitchClient.getStreamStatus as jest.Mock) = jest.fn().mockResolvedValue([
            { user_login: 'teststreamer', user_name: 'Test Streamer', title: 'Test Stream' }
        ]);
        process.env.WASHODO_MEMBERS = 'teststreamer';

        mockedAxios.post.mockResolvedValueOnce({ data: {} });

        const response = await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'test-token',
                text: '!streamers',
                channel_id: testChannelId,
                root_id: testRootId,
                user_name: 'testuser'
            });

        expect(response.status).toBe(200);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-server.com/api/v4/posts',
            expect.objectContaining({
                root_id: testRootId
            }),
            expect.anything()
        );
    });

    it('should propagate root_id even for unrecognized commands', async () => {
        const testRootId = 'root_unknown';
        const testChannelId = 'channel_unknown';
        
        mockedAxios.post.mockResolvedValueOnce({ data: {} });

        const response = await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'test-token',
                text: '!unknowncommand',
                channel_id: testChannelId,
                root_id: testRootId,
                user_name: 'testuser'
            });

        expect(response.status).toBe(200);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-server.com/api/v4/posts',
            expect.objectContaining({
                root_id: testRootId,
                message: expect.stringContaining('don\'t recognize a command')
            }),
            expect.anything()
        );
    });
});
