# Goal: Implement Discord Rate-Limit Handling

## Objective
Prevent login timeouts caused by Cloudflare rate limits (Error 1015) and provide visibility and control via the Admin Panel.

## Requirements
- **Persistence**: Store rate-limit expiry in the database.
- **Prevention**: Prevent login attempts while rate-limited to avoid extending the ban.
- **Visibility**: Display rate-limit status (Operational vs Rate Limited) in the Admin Panel.
- **Control**: Provide a "Force Retry" button in the Admin Panel to clear the limit and attempt login.

## Implementation Plan

### 1. Database Layer (`src/streamerStateRepository.ts`)
- Create a `discord_global_state` table (key-value pairs).
- Implement `getGlobalState(key)` and `setGlobalState(key, value)` methods.
- Implement `clearDiscordRateLimit()` helper.

### 2. Discord Logic (`src/clients/discord.client.ts` & `src/services/discord.notifier.ts`)
- **`DiscordClient.login()`**:
    - Pre-check: Abort if `discord_rate_limit_until` is in the future.
    - Error Handling: Catch 429 errors, extract `retry-after`, and save expiry to DB.
- **`DiscordNotifier`**:
    - `getStatus()`: Return current rate-limit state from DB.
    - `forceRetry()`: Clear DB limit and trigger `discordClient.login()`.

### 3. API Layer (`src/server.ts`)
- Ensure `/api/admin/discord/status` and `/api/admin/discord/retry` routes are correctly wired to `DiscordNotifier`.

### 4. UI Layer (`public/admin.html`)
- Add a status indicator in the Discord section.
- Add a "Force Retry Login" button.

## Current Progress
- [x] Research and architecture analysis completed.
- [ ] Database schema updates (Pending).
- [ ] Client login logic updates (Pending).
- [ ] Notifier method implementations (Pending).
- [ ] Admin Panel UI updates (Pending).

## Notes
- Root cause: Cloudflare Error 1015.
- The "Expected token to be set" error is a symptom of failed login due to rate limiting.
