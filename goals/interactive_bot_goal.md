# Project Goal: Mattermost Interactive Bot Integration

## 1. Overview
The objective is to evolve the existing Twitch Notifier bot from a one-way notification service into an interactive bot that can receive and respond to messages from multiple Mattermost servers via Outgoing Webhooks.

## 2. Technical Specification

### Environment Configuration
- **`BASE_URL`**: The public base URL of the bot server (e.g., `https://bot.example.com`).
- **`MATTERMOST_BOTS`**: A comma-separated list of server configurations. Each configuration is a pipe-separated string: `webhookToken|serverUrl|botAccessToken`.
  - *Example:* `token1|https://mm1.com|bot1,token2|https://mm2.com|bot2`

### Key Components
1. **Webhook Receiver**: 
    - An Express.js `POST` endpoint at `/mattermost/webhook`.
    - Logic to parse `MATTERMOST_BOTS` and validate the incoming `token` parameter against the registered webhook tokens.
2. **Command Handler**: 
    - Logic to parse incoming text and trigger specific bot actions (e.g., `!help`, `!status`).
3. **Response Engine**: 
    - Use the mapped `serverUrl` and `botAccessToken` to POST responses back to the original `channel_id` via the Mattermost REST API.
4. **Startup Utility**: 
    - Logic to calculate and log the full callback URL (`BASE_URL + '/mattermost/webhook'`) on startup for easy configuration.

## 3. Implementation Roadmap

### Phase 1: Infrastructure Update
- [ ] Add `BASE_URL` and `MATTERMOST_BOTS` to `.env` and `.env.example`.
- [ ] Update the server startup sequence to log the computed Webhook Callback URL.

### Phase 2: Receiver Development
- [ ] Implement the `POST /mattermost/webhook` route in Express.
- [ ] Implement the multi-server token lookup and validation logic.
- [ ] Create a basic command dispatcher to handle different trigger words.
- [ ] Integrate the resolved Bot Account token to send responses back to the specific server.

### Phase 3: Documentation & Setup
- [ ] Create `docs/mattermost-setup.md` containing:
    - Step-by-step guide to enabling Outgoing Webhooks in the Mattermost System Console.
    - Instructions on setting the trigger word and callback URL.
    - Guidance on how to format the `MATTERMOST_BOTS` variable.
    - Instructions on inviting the Bot Account to target channels.

### Phase 4: Validation
- [ ] Verify the startup log displays the correct URL.
- [ ] Perform end-to-end tests across multiple configured Mattermost servers.

## 4. Success Criteria
- The bot logs its callback URL on startup.
- The bot correctly identifies the source server based on the incoming webhook token.
- The bot responds to trigger words using the correct server-specific credentials.
- A comprehensive setup guide exists for non-technical configuration.
