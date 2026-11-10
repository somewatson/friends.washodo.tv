# Goal: Move BOT_SCHEDULE_TEXT to Database and Warden Admin Panel

## Objective
Migrate the static `BOT_SCHEDULE_TEXT` environment variable into the SQLite database and provide a management interface within the Warden admin panel. This will allow admins to update bot announcements in real-time without requiring a service restart and control which platforms receive these notifications.

## Proposed Features

### 1. Core Management
- **Database Persistence**: Move the schedule text from `.env` to a new `bot_settings` or `announcements` table in `data/streamers.db`.
- **Platform Targeting**: Add checkboxes in the admin panel to enable/disable delivery to:
    - **Discord**
    - **Mattermost**
    - **Twitch Chat** (New functionality)
- **Admin Interface**: Add a dedicated section in the Warden admin panel to edit the schedule text and targeting options.
- **Markdown Support**: Ensure the input field supports Markdown for rich formatting in Discord and Mattermost.
- **Live Preview**: Implement a preview window in the Warden panel to see how the text will appear in notifications.

### 2. Enhanced Functionality
- **Dynamic Placeholders**: Support "magic tags" for runtime replacement:
    - `{{today}}`: Current date.
    - `{{streamer_count}}`: Number of streamers currently live.
    - `{{team_link}}`: Link to the Twitch team page.
- **Expiration Dates**: Add an optional "Valid Until" date to announcements so they automatically expire (e.g., for time-limited events).
- **Scheduled Rotations**: (Optional/Phase 2) Ability to rotate multiple messages based on time of day or day of week.

### 3. UX & Reliability
- **Confirmation Dialogs**: Ensure "Save" actions have clear feedback and destructive changes are confirmed.
- **Environment Tagging**: Maintain the existing `[STAGING]` / `[DEV]` prefixing for notifications sent from non-production environments.

## Technical Implementation Steps
1. **Database Migration**: Create a migration script or update the DB schema to include the new settings table (including columns for `text`, `discord_enabled`, `mattermost_enabled`, `twitch_enabled`, and `expiry_date`).
2. **Twitch Chat Bot Integration**:
    - Implement a Twitch IRC client/wrapper to allow the bot to send messages to the tracked streamers' chats.
    - Configure Twitch bot credentials in `.env` and the database.
3. **Backend Update**: 
    - Create an API endpoint in `src/server.ts` to GET and POST the schedule settings.
    - Update the notification logic in the main loop to fetch the settings from the DB and check platform flags before sending.
4. **Frontend Update**: 
    - Add a "Bot Settings" view to the Warden admin panel.
    - Implement the text editor, platform checkboxes, and preview logic.
5. **Verification**: 
    - Verify that updates in the Warden panel are reflected in the next bot notification across all enabled platforms.
    - Run `npm run build` and `npm test` to ensure no regressions.
