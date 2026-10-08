# Goal: Implement Twitch Chatbot with OAuth Flow

## Objective
Transform the notification system into a fully interactive Twitch Chatbot with a professional, user-centric OAuth2 onboarding experience. The bot will respond to commands directly in Twitch chat and be managed via the website.

## Requirements
- Implement a professional OAuth2 "Authorization Code Grant" flow.
- Create a seamless UI/UX for bot authorization on the status website.
- Store bot credentials securely in the database with support for automatic token refreshing.
- Implement a persistent IRC connection for real-time chat interaction.
- Mirror the command functionality (`!help`, `!status`, `!streamers`, `!check`, `!schedule`) from Discord/Mattermost.

## Implementation Plan

### Phase A: OAuth Infrastructure & UI
- [ ] **Twitch Console Config**: Update Redirect URI to `https://friends.washodo.tv/auth/callback`.
- [ ] **Frontend Integration**: 
    - Add a "Connect Twitch Bot" button to the website.
    - Implement dynamic button states (Connect vs. Connected) based on bot status.
    - Add success/error notifications (toasts) on the index page after redirect.
- [ ] **API Server Routes**:
    - `GET /auth/twitch`: Redirect user to Twitch authorization page with `chat:edit` and `chat:read` scopes.
    - `GET /auth/callback`: Exchange auth code for tokens and redirect user back to home with a success/error flag.
    - `GET /api/bot/status`: Endpoint to check if a bot is currently authorized.
- [ ] **Database Migration**: Create a `bot_accounts` table to store `username`, `access_token`, `refresh_token`, and `expires_at`.

### Phase B: Token Management Service
- [ ] **BotAccountRepository**: Create a repository to handle CRUD operations for bot credentials.
- [ ] **Refresh Logic**: Implement a service to automatically refresh the access token using the refresh token before it expires.

### Phase C: The Chatbot Service
- [ ] **Library Setup**: Install `tmi.js`.
- [ ] **TwitchChatBot Service**: 
    - Establish a persistent WebSocket connection to Twitch IRC.
    - Implement a message listener to parse and handle commands.
    - Integrate with the existing `TwitchClient` for data and `BotAccountRepository` for credentials.
- [ ] **Auto-Join**: Automatically join channels of tracked members and friends on startup.

### Phase D: Integration & Testing
- [ ] **Bootstrap Integration**: Initialize and start the `TwitchChatBot` in `src/index.ts`.
- [ ] **User Experience Test**:
    1. Click "Connect Bot" on website $\rightarrow$ Authorize on Twitch $\rightarrow$ Redirected home with success message.
    2. Verify button state changes to "Connected".
    3. Verify bot joins channels and responds to `!status` in Twitch chat.
    4. Verify token refresh works (simulate expiry).

## Technical Notes
- **Auth Flow**: Client ID/Secret $\rightarrow$ Auth Code $\rightarrow$ Access/Refresh Tokens.
- **Connection**: WebSocket via `tmi.js`.
- **Consistency**: Commands should match the logic in `InteractiveReceiver`.
- **UX**: Use 302 redirects and query parameters (`?auth=success`) for simple, effective frontend feedback.
