# Goal: Sync Discord Server Button

## Objective
Add a "Sync Discord Server" button to the Warden admin panel to automatically detect or create announcement channels.

## Requirements
- Look for the "ward-bot" channel.
- Capture existing announcement channels if they exist.
- Create a new announcement channel if none are found.

## Implementation Plan

### 1. Analysis & Exploration
- **Frontend**: Locate the Discord management section of the Warden admin panel to determine where the button should be placed.
- **API Server**: Identify the route handler for Discord settings in `src/server.ts` (or related controllers) to add a new `/api/discord/sync` endpoint.
- **Discord Client**: Review `src/clients/discord.client.ts` to see how the bot currently interacts with channels and guilds.
- **Database**: Check how announcement channels are stored in `data/streamers.db` to ensure the sync process updates the state correctly.

### 2. Implementation Steps

#### Backend (API & Client)
- **Create a Sync Endpoint**: Add a POST route (e.g., `/api/discord/sync`) in the server. It must be protected by the `X-API-KEY` middleware.
- **Implement Sync Logic in `DiscordClient`**:
  - **Identify the Bot Channel**: Search for a channel named "ward-bot" (or similar configuration) to verify the bot's presence and permissions.
  - **Capture Existing Channels**: Scan the guild for existing announcement channels used by the bot.
  - **Fallback Creation**: If no suitable announcement channels are found, use the `discord.js` API to create a new one with the appropriate permissions.
  - **Update Database**: Save the discovered/created channel IDs back to the SQLite database so the bot knows where to post notifications.

#### Frontend (Warden Panel)
- **Add Sync Button**: Add a "Sync Server" button to the Discord settings UI.
- **Styling**: Ensure it follows the `washodo_style_guide.md` (Washodo Purple/Sky Blue).
- **UX**: 
  - Implement a loading state while the sync is in progress.
  - Add a confirmation dialog before syncing (as per the destructive/significant action policy).
  - Use in-page toast/banner notifications to report success or failure instead of `alert()`.

### 3. Verification
- **Build**: Run `npm run build` to ensure no TypeScript errors were introduced.
- **Manual Test**: Use the admin panel to trigger the sync and verify that channels are correctly identified or created in Discord and updated in the DB.
