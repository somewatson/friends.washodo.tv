# Implementation Plan: Discord Session Resumption

## Objective
Migrate the Discord bot architecture to utilize persisted `SessionInfo` via the `ShardingManager` and `discord_sessions` table. This will enable "silent resumption" of bot sessions, reducing "bot joined" spam and mitigating rate limits during restarts.

## Technical Background
Currently, the system persists session data in SQLite but does not use it during the `Client.login()` process in the child shards. Every restart triggers a full `IDENTIFY` handshake. To fix this, we must implement a loop:
`DB` $\rightarrow$ `ShardingManager` $\rightarrow$ `Shard Process` $\rightarrow$ `Discord Gateway (RESUME)` $\rightarrow$ `Shard Process` $\rightarrow$ `DB`.

---

## Detailed Task Breakdown

### 1. Enhance `bot.js` (The Shard Entry Point)
The shard process is where the `discord.js` Client actually lives. It needs to be able to both *consume* and *produce* session information.

- **Session Consumption**: 
    - Modify the `Client` initialization to check for session data passed from the parent process (via environment variables or `process.env`).
    - If session data exists, configure the client to attempt a resume.
- **Session Production**:
    - Implement a listener for the `ready` event.
    - Extract `client.ws.shard.sessionInfo`.
    - Send this `SessionInfo` object back to the parent process using `client.ws.shard.send()` or `process.send()`.

### 2. Update `DiscordNotifier` (The Parent Process)
`DiscordNotifier` manages the `ShardingManager` instances. It must act as the bridge between the database and the shards.

- **Injection Logic**:
    - Before calling `manager.spawn()`, query `stateRepo.getDiscordSession(tokenHash)`.
    - Pass the retrieved session data to the `ShardingManager` options. Since `ShardingManager` options are passed to the child process as environment variables, we should map them to a structured string (e.g., JSON) in `process.env`.
- **Persistence Logic**:
    - Add an IPC listener to the `ShardingManager` or the spawned shards.
    - When a `SESSION_UPDATE` message is received from a shard, call `stateRepo.saveDiscordSession()` to update the `discord_sessions` table with the latest `sessionId`, `userSequence`, etc.

### 3. Database Repository Updates (`StreamerStateRepository`)
Ensure the repository has the necessary methods to support this flow.
- Verify `saveDiscordSession(tokenHash, sessionInfo)` exists and correctly handles the `SessionInfo` interface.
- Verify `getDiscordSession(tokenHash)` returns the data in a format compatible with the `discord.js` Session interface.

### 4. Resilience & Validation
- **Invalid Session Handling**: Implement a mechanism where, if the shard receives an `INVALID_SESSION` event from the gateway, it notifies the parent to clear the session from the DB and performs a fresh `IDENTIFY`.
- **Logging**: Add specific logs for `[Discord] Attempting session resume...` and `[Discord] Session resumed successfully` to allow verification in the admin logs.

---

## Success Criteria
1. **Verification**: Restart the application. In the logs, the bot should indicate it is "Resuming" rather than "Identifying".
2. **Observation**: In a test Discord server, the bot should NOT trigger a "Bot joined the server" system message upon restart.
3. **Persistence**: Verify that the `discord_sessions` table is updated automatically whenever the bot reaches the `ready` state.

## Files to be Modified
- `src/services/discord.notifier.ts`: To handle session injection and IPC listening.
- `src/bot.ts` (or the source for `dist/bot.js`): To handle session consumption and reporting.
- `src/streamerStateRepository.ts`: To ensure DB methods are robust.
