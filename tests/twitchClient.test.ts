import { TwitchClient } from '../src/twitchClient';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TwitchClient', () => {
    let twitchClient: TwitchClient;

    beforeEach(() => {
        process.env.TWITCH_CLIENT_ID = 'test_client_id';
        process.env.TWITCH_CLIENT_SECRET = 'test_client_secret';
        twitchClient = new TwitchClient();
        jest.clearAllMocks();
    });

    it('should fetch access token on first call', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { access_token: 'test_token' } });
        
        const token = await twitchClient.getAccessToken();
        
        expect(token).toBe('test_token');
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://id.twitch.tv/oauth2/token',
            null,
            expect.objectContaining({
                params: {
                    client_id: 'test_client_id',
                    client_secret: 'test_client_secret',
                    grant_type: 'client_credentials',
                }
            })
        );
    });

    it('should reuse access token', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { access_token: 'test_token' } });
        
        await twitchClient.getAccessToken();
        await twitchClient.getAccessToken();
        
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should fetch live streamers', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { access_token: 'test_token' } });
        mockedAxios.get
            .mockResolvedValueOnce({
                data: {
                    data: [{ user_login: 'streamer1', user_id: '123', user_name: 'Streamer One' }]
                }
            })
            .mockResolvedValueOnce({
                data: {
                    data: [{ id: '123', login: 'streamer1', display_name: 'Streamer One', profile_image_url: 'http://pic.png' }]
                }
            });
        
        const live = await twitchClient.getLiveStreamers(['streamer1']);
        
        expect(live[0]).toMatchObject({ 
            user_login: 'streamer1', 
            displayName: 'Streamer One',
            profile_image_url: 'http://pic.png'
        });
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://api.twitch.tv/helix/streams',
            expect.objectContaining({
                params: { user_login: ['streamer1'] },
                headers: {
                    'Client-ID': 'test_client_id',
                    'Authorization': 'Bearer test_token',
                }
            })
        );
    });
});
