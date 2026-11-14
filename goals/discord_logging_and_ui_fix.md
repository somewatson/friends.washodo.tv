# Plan: Improve Discord Login Logging and Fix Admin Panel Error

## 1. Analysis & Investigation Phase

### Discord Sharding & Logging
- **Examine `src/services/discord.notifier.ts`**: Analyze how `ShardingManager` is instantiated and how it manages the login process.
- **Examine Shard implementation**: Investigate why `Ready event fired but no sessionInfo found on shard` occurs. Check the `ready` (or `clientReady`) event handler.
- **Review Session Persistence**: Verify the flow of `SessionInfo` between the `discord_sessions` table and the ShardingManager.

### Admin Panel Error (`toLocaleString`)
- **Locate Discord Page**: Find the frontend code for the Discord administration page.
- **Trace Data Flow**: Identify the API endpoint providing data to the Discord page and inspect the response structure for missing timestamps/dates.

## 2. Proposed Improvements

### Enhanced Logging for Discord Login
Implement "Decision Point" logs:
- **Pre-Login**: Log Bot ID and whether a persisted session was retrieved from the DB.
- **Handshake Phase**: Log the attempt to connect and whether resume data is being used.
- **Post-Connection**: 
    - Distinguish between `RESUME` and `IDENTIFY` (fresh login) in logs.
    - Log the exact capture and save of `sessionInfo` to the DB.
- **Error States**: Detailed logs for auth failures or gateway errors.

### Fixing the Admin Panel Crash
- **Frontend Guard**: Implement optional chaining (`?.`) or null checks before calling `.toLocaleString()` to prevent UI crashes.
- **API Consistency**: Ensure the backend always returns a consistent value for timestamp fields.

## 3. Verification Plan
- **Log Verification**: 
    - Clear `discord_sessions` $\rightarrow$ Verify "Fresh Login" logs.
    - Restart $\rightarrow$ Verify "Resumed Session" logs.
- **UI Verification**: Confirm the Discord admin page loads without errors regardless of rate limit state.
- **Build Integrity**: Run `npm run lint` and `npm run build` to verify no regressions.
