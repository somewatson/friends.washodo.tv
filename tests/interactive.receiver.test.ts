import request from 'supertest';
import express from 'express';
import { InteractiveReceiver } from '../src/services/interactive.receiver';
import { WebhookNotifier } from '../src/services/webhook.service';
import { TwitchClient } from '../clients/twitch.client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InteractiveReceiver', () => {
    let receiver: InteractiveReceiver;
    let app: express.Application;
    let mockNotifier: any;
    let mockTwitchClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockNotifier = {};
        mockTwitchClient = {
            getStreamStatus: jest.fn(),
        };
        
        // Set environment variables for server config
        process.env.MATTERMOST_BOTS = 'validToken|http://test-server.com|botToken';
        
        receiver = new InteractiveReceiver(mockNotifier, mockTwitchClient);
        app = receiver.getApp();
    });

    it('should allow request with valid token', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });
        
        const response = await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'validToken',
                text: '!status',
                channel_id: 'chan1',
                user_name: 'testuser'
            });
        
        expect(response.status).toBe(200);
        expect(response.text).toBe('OK');
    });

    it('should reject request with invalid token', async () => {
        const response = await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'invalidToken',
                text: '!status',
                channel_id: 'chan1',
                user_name: 'testuser'
            });
        
        expect(response.status).toBe(401);
        expect(response.text).toBe('Unauthorized');
    });

    it('should respond to !status command', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });
        
        await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'validToken',
                text: '!status',
                channel_id: 'chan1',
                user_name: 'testuser'
            });
        
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-server.com/api/v4/posts',
            expect.objectContaining({
                message: expect.stringContaining('✅ Bot is active and monitoring streamers!'),
            }),
            expect.any(Object)
        );
    });

    it('should handle the "truth-confirming" logic', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });
        
        await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'validToken',
                text: 'Is this true?',
                channel_id: 'chan1',
                user_name: 'testuser'
            });
        
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-server.com/api/v4/posts',
            expect.objectContaining({
                message: expect.stringContaining('Of course, that sounds about right!'),
            }),
            expect.any(Object)
        );
    });

    it('should correctly route !help command', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });
        
        await request(app)
            .post('/mattermost/webhook')
            .send({
                token: 'validToken',
                text: '!help',
                channel_id: 'chan1',
                user_name: 'testuser'
            });
        
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://test-server.com/api/v4/posts',
            expect.objectContaining({
                message: expect.stringContaining('Bot Help Menu'),
            }),
            expect.any(Object)
        );
    });
});
