# Plan: Fix Discord Session Capture and Admin Panel Data Issues

## Objective
Resolve the failure to capture `sessionInfo` during Discord bot startup and fix the `undefined` server names in the Discord admin panel.

## 1. Discord Session Capture Fix
The current logs show: `[STAGING] [DiscordBot] Ready event fired but no sessionInfo found on shard.` This prevents session resumption and forces fresh `IDENTIFY` handshakes.

### Tasks
- **Event Migration**: Change the event listener in `src/bot.ts` from `ready` to `clientReady` to adhere to `discord.js` v14+ standards and avoid deprecation warnings.
- **State Inspection**: Add debug logging to `src/bot.ts` to inspect the `shard` object structure when the bot is ready. This will confirm the actual path to the session data if `sessionInfo` is not the correct key.
- **Resilience**: Implement a short delay (e.g., 500ms) or a retry mechanism if `sessionInfo` is missing immediately upon the ready event, as the gateway handshake may still be finalizing.
- **Fallback Mechanism**: Implement a fallback in `DiscordNotifier` to attempt retrieving session data via `broadcastEval` from the parent process if the child worker fails to report it via IPC.

## 2. Admin Panel Data Fix
The Discord admin table displays `undefined` for server names, indicating a property mismatch between the API response and the frontend.

### Tasks
- **Property Alignment**: 
    - Update `public/admin.js` to use a resilient fallback for server names: `${d.serverName || d.guildName || 'Unknown Server'}`.
- **API Contract**: 
    - Review the API controller handling `/api/admin/discord` to ensure the response object keys match the frontend expectations (consistency between `guildName` and `serverName`).
- **UI Polish**: Ensure no other fields in the Discord table (Channel ID, Owner, etc.) are prone to rendering `undefined`.

## 3. Verification Plan
- **Session Resumption**: 
    1. Start bot $\rightarrow$ Verify `Captured session info` log.
    2. Restart bot $\rightarrow$ Verify `[Decision Point] ... Handshake: RESUME` log.
- **UI Verification**:
    1. Load the `/warden/discord` page.
    2. Verify that all server names are correctly displayed (no `undefined` values).
- **Build Integrity**:
    1. Run `npm run lint`.
    2. Run `npm run build`.
