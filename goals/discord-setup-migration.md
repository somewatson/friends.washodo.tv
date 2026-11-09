# Goal: Discord Auto-Setup & Configuration Migration

## Objective
Implement a seamless Discord channel setup process (OAuth2 and Slash Commands), migrate static `.env` configurations to a portable SQLite database, and provide an admin interface for management.

## Requirements
- **Discord Channel Setup**:
    - Support both an OAuth2 "Install Link" and a `/setup` slash command.
    - Automatically create a channel named `#📯-ward-bot`.
    - Save `guild_id` and `channel_id` to the database.
- **Database Migration**:
    - Move `TRACKED_STREAMERS`, `WASHODO_MEMBERS`, and `WASHODO_FRIENDS` to a `tracked_entities` table.
    - Move `MATTERMOST_BOTS` to a `mattermost_configs` table.
    - Maintain `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `DISCORD_BOT_TOKEN` in `.env` (secrets).
- **Admin Interface**:
    - Basic UI to manage Discord integrations (guilds, channels).
    - Basic UI to manage Mattermost configurations (servers, tokens).
    - Basic UI to manage the streamer/member/friend lists.
- **Portability**:
    - Implement a simple import/export mechanism for the SQLite database.
    - Update `AGENTS.md` to maintain these standards.

## Implementation Plan

### Phase 1: Database Schema & Migration
- [ ] Design and implement new SQLite tables in `data/streamers.db`:
    - `discord_integrations` (`guild_id`, `channel_id`, `owner_id`, `permissions`)
    - `mattermost_configs` (`id`, `server_url`, `webhook_token`, `bot_token`, `channel_id`, `label`)
    - `tracked_entities` (`username`, `platform`, `category`, `is_active`)
- [ ] Create a migration script to move existing data from `.env` to these tables.
- [ ] Implement `db-export` and `db-import` CLI utilities.

### Phase 2: Discord Integration
- [ ] Implement OAuth2 callback endpoint in `src/server.ts` to handle bot installations.
- [ ] Implement logic to create the `#📯-ward-bot` channel using Discord API.
- [ ] Implement `/setup` slash command for manual channel creation/mapping.
- [ ] Update `src/clients/discord.client.ts` to handle channel creation and database updates.

### Phase 3: Admin Interface
- [ ] Create a secure admin route/endpoint for managing settings.
- [ ] Build a simple frontend (or API-based interface) to:
    - Edit/Delete Mattermost server configs.
    - View/Edit Discord integration mappings.
    - Add/Remove streamers, members, and friends.

### Phase 4: Refactoring & Documentation
- [ ] Update the main loop (`src/index.ts`) to fetch target channels and streamers from the database instead of `.env`.
- [ ] Update `AGENTS.md` with persistence and portability guidelines.
- [ ] Verify deployment using `npm run verify`.
