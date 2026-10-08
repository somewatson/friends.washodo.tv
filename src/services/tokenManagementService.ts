import axios from 'axios';
import { BotAccount, BotAccountRepository } from '../repositories/botAccountRepository';

export class TokenManagementService {
    constructor(private botRepo: BotAccountRepository) {}

    async getValidAccessToken(): Promise<string | null> {
        const account = await this.botRepo.getAccount();
        if (!account) {
            console.log('[TokenManagementService] No bot account configured.');
            return null;
        }

        const now = new Date();
        const expiresAt = new Date(account.expiresAt);

        // Refresh if token expires in less than 5 minutes
        if (now.getTime() > expiresAt.getTime() - 5 * 60 * 1000) {
            console.log('[TokenManagementService] Token expiring soon, refreshing...');
            return await this.refreshAccessToken(account);
        }

        return account.accessToken;
    }

    private async refreshAccessToken(account: BotAccount): Promise<string | null> {
        try {
            const clientId = process.env.TWITCH_CLIENT_ID;
            const clientSecret = process.env.TWITCH_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                throw new Error('Missing Twitch credentials for token refresh');
            }

            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: account.refreshToken,
                },
            });

            const { access_token, refresh_token, expires_in } = response.data;
            const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

            await this.botRepo.saveAccount({
                username: account.username,
                accessToken: access_token,
                refreshToken: refresh_token || account.refreshToken, // Use new refresh token if provided
                expiresAt
            });

            console.log('[TokenManagementService] Token refreshed successfully');
            return access_token;
        } catch (error: any) {
            console.error('Error refreshing Twitch access token:', error.response?.data || error.message);
            return null;
        }
    }
}
