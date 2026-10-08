import { TwitchClient } from '../src/clients/twitch.client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TwitchClient', () => {
    let client: TwitchClient;
    const mockConfig = {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        client = new TwitchClient(mockConfig);
    });

    it('should correctly parse getStreamStatus responses', async () => {
        // 1. Mock token fetch (axios.post)
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                access_token: 'mock_token',
                expires_in: 3600
            }
        });

        // 2. Mock stream status (axios.get)
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                data: [
                    {
                        user_login: 'streamer1',
                        user_name: 'Streamer One',
                        game_name: 'Just Chatting',
                        title: 'Live Title 1',
                        thumbnail_url: 'http://twitch.tv/thumb1.jpg'
                    }
                ]
            }
        });

        const results = await client.getStreamStatus(['streamer1']);
        
        expect(results).toHaveLength(1);
        expect(results[0].user_login).toBe('streamer1');
        expect(results[0].user_name).toBe('Streamer One');
    });

    it('should return an empty array when no streams are live', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                access_token: 'mock_token',
                expires_in: 3600
            }
        });

        mockedAxios.get.mockResolvedValueOnce({
            data: {
                data: []
            }
        });

        const results = await client.getStreamStatus(['offline_user']);
        
        expect(results).toEqual([]);
    });
});
