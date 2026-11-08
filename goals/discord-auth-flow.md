# Plan: Discord Authorization Flow & Documentation

## Objective
Implement a dynamic Discord invite system that allows users to authorize the Washodo Ward bot for their own servers, accompanied by detailed setup instructions and privacy disclosures.

## Technical Requirements

### 1. API Implementation
**Endpoint**: `/api/discord/invite`
- **Functionality**: Generate a signed Discord OAuth2 authorization URL.
- **OAuth2 Scopes**:
    - `bot`
    - `applications.commands`
- **Bot Permissions (Bitfield)**:
    - `VIEW_CHANNEL` (0x400)
    - `SEND_MESSAGES` (0x800)
    - `SEND_MESSAGES_IN_THREADS` (0x1000000000)
    - `READ_MESSAGE_HISTORY` (0x10000)
    - `EMBED_LINKS` (0x4000)
- **Logic**: The endpoint should return a redirect or a JSON object containing the generated URL using the bot's Client ID from the environment variables.

### 2. Frontend Documentation Page
**Location**: New page/route (e.g., `/discord-setup`)
- **Dynamic Integration**: The "Authorize" button must fetch the link from `/api/discord/invite`.
- **Step-by-Step Guide**:
    1. Click "Authorize Washodo Ward".
    2. Select the target server from the dropdown (requires `Manage Server` permission).
    3. Review the requested permissions.
    4. Click "Authorize".
- **Permissions Transparency Table**:
    | Permission | Explanation |
    | :--- | :--- |
    | View Channels | Required to find the channels where the bot is needed. |
    | Send Messages | Allows the bot to respond to users and post updates. |
    | Send Messages in Threads | Essential for participating in organized discussions/threads. |
    | Read Message History | Helps the bot understand context when pinged. |
    | Embed Links | Enables the use of formatted "Embed" messages for better readability. |
- **Privacy Section**:
    - Explicit statement that the bot only processes messages where it is mentioned or a slash command is used.
    - Confirmation that no private user data is scraped or stored outside the necessary scope of functionality.

## Execution Steps
1. [ ] **Backend**: Create the invite route in the API.
2. [ ] **Backend**: Implement the permission bitfield logic and URL construction.
3. [ ] **Backend**: Update `src/services/discord.notifier.ts` to ensure the bot only responds to direct mentions of its User ID, ignoring `@everyone`, `@here`, and other role pings.
4. [ ] **Backend**: Update `src/services/interactive.receiver.ts` to refine mention triggers for Mattermost.
5. [ ] **Frontend**: Create the documentation page with the instructions and privacy table.
6. [ ] **Frontend**: Connect the "Authorize" button to the API endpoint.
7. [ ] **Testing**: Verify the link generates correctly and the Discord authorization screen shows the exact permissions requested.
8. [ ] **Testing**: Verify the bot ignores `@everyone` and `@here` pings but still responds to direct mentions.
