# Goal: Implement Discord Rate-Limit Handling

## Objective
Prevent login timeouts caused by Cloudflare rate limits (Error 1015) and provide visibility and control via the Admin Panel.

## Requirements
- **Persistence**: Store rate-limit expiry and session tokens in the database.
- **Prevention**: Prevent login attempts while rate-limited to avoid extending the ban.
- **Session Caching**: Cache valid Discord session tokens to reduce authentication pings during server restarts.
- **Visibility**: Display rate-limit status and session state (Cached vs Fresh) in the Admin Panel.
- **Control**: Provide a "Force Retry" button in the Admin Panel to clear the limit and attempt login.
- **Header Awareness**: Monitor Discord API response headers to proactively handle rate limits.

## Implementation Plan

### 1. Database Layer (`src/streamerStateRepository.ts`)
- Create a `discord_global_state` table (key-value pairs).
- Implement `getGlobalState(key)` and `setGlobalState(key, value)` methods.
- Implement `clearDiscordRateLimit()` helper.
- Store the active session token and validation timestamp.

### 2. Discord Logic (`src/clients/discord.client.ts` & `src/services/discord.notifier.ts`)
- **`DiscordClient.login()`**:
    - Pre-check: Abort if `discord_rate_limit_until` is in the future.
    - **Session Check**: Attempt to use cached session token before performing full login.
    - **Invalidation**: Clear cache and re-authenticate if a `401 Unauthorized` is encountered.
    - Error Handling: Catch 429 errors, extract `retry-after`, and save expiry to DB.
- **`DiscordNotifier`**:
    - `getStatus()`: Return current rate-limit state and session status from DB.
    - `forceRetry()`: Clear DB limit, clear session cache, and trigger `discordClient.login()`.
- **Header Monitoring**: Wrap API calls to track `X-RateLimit` headers.

### 3. API Layer (`src/server.ts`)
- Ensure `/api/admin/discord/status` and `/api/admin/discord/retry` routes are correctly wired to `DiscordNotifier`.

### 4. UI Layer (`public/admin.html`)
- Add a status indicator in the Discord section.
- Add a "Force Retry Login" button.
- Display whether the current session is cached or fresh.

## Current Progress
- [x] Research and architecture analysis completed.
- [x] Database schema updates (Completed).
- [x] Client login logic updates (Completed).
- [x] Notifier method implementations (Completed).
- [x] Admin Panel UI updates (Completed).
- [ ] Session Caching & Token Persistence (Pending).
- [ ] Header Monitoring & Proactive Throttling (Pending).

## Notes
- Root cause: Cloudflare Error 1015.
- The "Expected token to be set" error is a symptom of failed login due to rate limiting.
