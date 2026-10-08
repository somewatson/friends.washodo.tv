# Discord Integration & Reliable Notification Plan

## Objective
Implement a multi-bot Discord notification system and a reliable, per-channel notification tracking system to ensure streamers are notified across all platforms without duplicates or misses.

## Architectural Design

### 1. Configuration
To support multiple bots and channels, we will use delimited environment variables in `.env`:
- `DISCORD_BOTS=token1|channelId1,token2|channelId2,token3|channelId3`
- `MATTERMOST_BOTS=webhookToken|serverUrl|botToken|channelId,...`

### 2. Reliable Notification Tracking (SQLite)
To ensure delivery across multiple platforms and channels, we will move from a global timestamp to a per-target log.

#### Database Schema (`notification_log` table):
- `username` (TEXT)
- `platform` (TEXT): 'mattermost' or 'discord'
- `target_id` (TEXT): The specific channel ID
- `sent_at` (TEXT): ISO timestamp
- **Primary Key**: `(username, platform, target_id)`

#### Logic:
- **Check**: Before sending, query the log for the specific `(username, platform, target_id)` combination.
- **Condition**: Only notify if no record exists or the `sent_at` time exceeds the defined interval.
- **Confirmation**: Only record the notification in the database **after** a successful API response (2xx). This ensures that failed deliveries are retried in the next cycle.

### 3. `DiscordNotifier` Service
A new service `src/services/discord.notifier.ts` will be created.

#### Key Components:
- **Client Manager**: Maintains a map of `token` $\rightarrow$ `Discord.Client`.
- **Multi-Client Initialization**: Parses `DISCORD_BOTS` and initializes a separate Discord client for each unique token.
- **Dispatch Logic**: Iterates through all configured token/channel pairs, checks the `notification_log`, and sends notifications to the respective channels.
- **Rich Embeds**: 
    - **Title**: Streamer name + "is LIVE!"
    - **Description**: The stream title.
    - **Thumbnail**: The proxied Twitch thumbnail.
    - **Color**: A "Live Red" accent.

### 4. Integration Points
- **`src/index.ts`**: 
    - Initialize the `DiscordNotifier` during the `bootstrap()` sequence.
    - Add the Discord notification call to the main polling loop.
- **`src/streamerStateRepository.ts`**: Implement methods for managing the `notification_log`.
- **`package.json`**: Add `discord.js` as a dependency.
- **Documentation**: Create a `docs/discord_setup.md` guide explaining how to create a Discord Application, generate bot tokens, and configure permissions.

## Technical Considerations
- **Rate Limiting**: Implement a small random delay (jitter) between messages to avoid Discord's rate limiters when notifying across multiple channels.
- **Resource Management**: Ensure all clients are properly logged out/disconnected during server shutdown.
- **Permissions**: Bots will require `Send Messages` and `Embed Links` permissions in the target channels.

## Success Criteria
- [ ] `discord.js` is installed and configured.
- [ ] Database migration for `notification_log` table is implemented.
- [ ] Bot tokens and channel IDs are correctly parsed from `.env`.
- [ ] Multiple bots can independently send notifications to their assigned channels.
- [ ] Notifications appear as rich embeds with the correct streamer data.
- [ ] Notification tracking is per-platform and per-channel, preventing misses and duplicates.
- [ ] The system handles invalid tokens or missing channels gracefully without crashing the main loop.
