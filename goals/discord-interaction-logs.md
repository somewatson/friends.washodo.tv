# Goal: Discord Interaction Logging for Admin Panel

## Objective
Implement a system to capture, store, and display Discord bot interactions within the Warden Admin Panel to improve user experience visibility and bot iteration.

## Proposed Implementation

### 1. Persistence Layer (SQLite)
- Create a new table `discord_logs` in `data/streamers.db`.
- **Schema**:
    - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
    - `timestamp`: DATETIME DEFAULT CURRENT_TIMESTAMP
    - `username`: TEXT (Discord user tag)
    - `guild_name`: TEXT (Server name)
    - `channel_name`: TEXT (Channel name)
    - `content`: TEXT (Message content)
    - `command`: TEXT (The matched command, if any)
- **Retention Policy**: Implement a cleanup mechanism to keep only the most recent 1,000 entries to prevent database bloat.

### 2. Data Collection
- Modify `DiscordCommandHandler.handleCommand` in `src/services/discord/command.handler.ts`.
- After receiving a message, asynchronously save the interaction details to the `discord_logs` table via the `StateRepository`.
- Ensure this happens independently of whether a command was successfully matched, allowing for "failed" interaction tracking.

### 3. API Endpoint
- Create a new protected route in `src/server.ts`: `GET /api/admin/discord/logs`.
- The endpoint should:
    - Validate the `X-API-KEY`.
    - Fetch the latest logs from the database.
    - Return a JSON array of logs sorted by timestamp descending.

### 4. Admin UI Integration
- Add a "Discord Logs" section to the Warden Admin Panel.
- **UI Requirements**:
    - **Table View**: Display columns for Timestamp, User, Server, Channel, and Message.
    - **Styling**: Follow `washodo_style_guide.md` (Dark Mode, Washodo Purple `#a970ff`).
    - **UX**: Implement a simple search/filter by username or server name.
    - **Responsiveness**: Ensure the table is responsive and prevents horizontal scrolling.

## Success Criteria
- [ ] Discord interactions are appearing in the SQLite `discord_logs` table.
- [ ] `/api/admin/discord/logs` returns the correct interaction history.
- [ ] The Admin Panel displays a readable, stylized log of Discord interactions.
- [ ] Old logs are automatically pruned to maintain performance.
