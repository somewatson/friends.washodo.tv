import axios from 'axios';
import { BotAccountRepository } from '../repositories/botAccountRepository';
import { BotAccount } from '../types/bot.types';

export class TwitchTokenService {
    private botRepo: BotAccountRepository;
    private clientId = process.env.TWITCH_CLIENT_ID;
    private clientSecret = process.env.TWITCH_CLIENT_SECRET;

    constructor(botRepo: BotAccountRepository) {
        this.botRepo = botRepo;
    }

    async getValidToken(): Promise<string | null> {
        const account = await this.botRepo.getActiveAccount();
        if (!account) return null;

        if (this.isTokenExpired(account.expiresAt)) {
            console.log(`Token expired for ${account.username}, refreshing...`);
            const refreshedAccount = await this.refreshAccessToken(account);
            if (!refreshedAccount) return null;
            return refreshedAccount.accessToken;
        }

        return account.accessToken;
    }

    private isTokenExpired(expiresAt: string): boolean {
        const expiryDate = new Date(expiresAt);
        // Refresh 5 minutes before actual expiry to be safe
        return Date.now() > expiryDate.getTime() - 5 * 60 * 1000;
    }

    private async refreshAccessToken(account: BotAccount): Promise<BotAccount | null> {
        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: account.refreshToken
                }
            });

            const { access_token, refresh_token, expires_in } = response.data;
            const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

            const updatedAccount: BotAccount = {
                username: account.username,
                accessToken: access_token,
                refreshToken: refresh_token || account.refreshToken, // Twitch might not always return a new refresh token
                expiresAt
            };

            await this.botRepo.saveAccount(updatedAccount);
            console.log(`Successfully refreshed token for ${account.username}`);
            return updatedAccount;
        } catch (error) {
            console.error('Error refreshing Twitch access token:', error);
            return null;
        }
    }
}
