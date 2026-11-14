# Goal: Resolve Discord Session Capture Path and Guild Name Retrieval

## Objective
Correct the path to `sessionInfo` in the Discord bot worker to enable session resumption and resolve the "Unknown Server" issue in the admin panel.

## 1. Session Capture Path Fix
Debug logs revealed that `client.ws.shard` is undefined, while `client.ws.shards` is an array containing the shard.

### Tasks
- **Update Path**: In `src/bot.ts`, change session info access from `(client.ws as any).shard` to `(client.ws as any).shards?.[0]`.
- **Verify**: Restart bot $\rightarrow$ confirm `Captured session info` log.

## 2. Guild Name Retrieval Fix
The admin panel shows "Unknown Server" because `guildName` is not being returned by the API.

### Tasks
- **Diagnostic Logging**: Add logging inside `DiscordNotifier.getActiveTargets` (in `src/services/discord.notifier.ts`)'s `broadcastEval` to inspect why `channel?.guild?.name` is null.
- **Implement Fix**: Ensure the guild is properly fetched/cached.

## 3. Verification Plan
- **Session Capture**: Bot startup $\rightarrow$ `Captured session info` log.
- **Session Resumption**: Restart bot $\rightarrow$ `Handshake: RESUME` log.
- **UI Verification**: `/warden/discord` page $\rightarrow$ Server names correctly displayed.
- **Build**: `npm run build` succeeds.
