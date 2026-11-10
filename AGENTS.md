# Agent Instructions: Washodo Ward

Compact guide for OpenCode agents to avoid common pitfalls and ramp up quickly in this repository.

## 🛠 Developer Commands
- **Dev Server**: `npm run dev` (uses `nodemon` on `src/index.ts`)
- **Build**: `npm run build` (compiles TS to `dist/`)
- **Start**: `npm start` (runs `node dist/index.js`)
- **Test**: `npm test` (runs `jest`)
- **Deployment Verify**: `npm run verify` (runs `scripts/verify-deploy.ts`)

## 🏗 Architecture & Flow
- **Hybrid Nature**: Node.js/TypeScript. Source in `src/`, builds to `dist/`.
- **Main Loop**: `src/index.ts` bootstraps the app and schedules a `node-cron` job based on `CHECK_INTERVAL`.
- **Persistence**: 
  - **CRITICAL**: Use SQLite (`data/streamers.db`) for all persistent state.
  - **Forbidden**: Do not use `state.json` or other loose JSON files for application state.
  - **Portability**: Use `scripts/db-portable.ts` for importing/exporting the database. All dynamic configuration (Mattermost targets, Discord guilds, tracked streamers) must reside in the database, not in `.env`.
- **Discord Integration**: 
  - Use the `DiscordClient` wrapper in `src/clients/discord.client.ts`.
  - All Discord interactions are handled via the `discord.js` library to ensure proper rate limiting, type safety, and 64-bit permission handling.
- **Network Resilience**: 
  - All HTTP calls **must** have explicit timeouts (default 10s).
  - Use exponential backoff for retries to avoid hammering unreachable servers.
  - Avoid unbounded `Promise.all()` on network requests; use batching or sequential processing.
  - **Isolation**: Ensure failures in one external service (e.g., Mattermost) do not block or cancel requests to others (e.g., Discord).
- **Observability & I/O**:
  - **Avoid log storms**: Do not log every single failure in tight loops. Implement throttled, deduplicated, or summarized logging to prevent disk I/O spikes that can trigger filesystem read-only locks.
- **Notifications**: 
  - **Environment Tagging**: All outgoing notifications (Discord, Mattermost, etc.) **must** be prefixed with the current environment if it is not `production` (e.g., `[STAGING]`, `[DEV]`). This prevents confusion between test and live notifications.
  - **Broadcasts vs Live Alerts**: "Broadcast messages" (scheduled global announcements) are a distinct concept from "Live Streamer announcements" (triggered by Twitch status). The broadcast preview should only display global broadcast messages.
- **Entrypoints**:
  - `src/index.ts`: Application bootstrap and cron scheduler.
  - `src/server.ts`: API server for external status checks and admin interface.
  - `src/clients/twitch.client.ts`: Wrapper for Twitch API interactions.

- **Route Authentication & Browser Access**:
  - **API Routes**: Most `/api/*` routes require the `X-API-KEY` header for authentication.
  - **Browser Routes**: Routes intended to be accessed directly via a browser (e.g., `/`, `/warden-gate`, `/warden/*`, `/discord-setup`) must be added to the bypass list in the API Key Middleware in `src/server.ts`. Otherwise, the server will return a `401 Unauthorized` error because browsers do not send the required `X-API-KEY` header.
  - **Warden Auth**: The `/warden/*` panel uses a separate cookie-based authentication flow (`warden_auth`) which is checked *after* the API Key bypass.

## ⚙️ Configuration & Env
- **Env Template**: `.env.example`
- **Key Variables**:
  - `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`: Required for Twitch API.
  - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`: Required for Discord OAuth2 flow.
  - `DISCORD_BOT_TOKEN`: Primary token for bot operations (creating channels, etc.).
  - `APP_ENV`: The current environment (`production`, `staging`, `development`). Used to prefix notifications in non-prod.
  - `API_KEY`: Used for `X-API-KEY` header authentication on admin and status endpoints.
  - `BASE_URL`: The public URL of the bot (required for OAuth2 callbacks). Must match the Redirect URIs configured in the Discord Developer Portal.
  - `ADMIN_USERNAME`: Username for the Warden admin panel.
  - `ADMIN_PASSWORD`: Password for the Warden admin panel.
  - *Note: Tracked streamers and notification targets have been migrated to the SQLite database.*

## 🧪 Testing Quirks
- **Framework**: `jest` with `ts-jest`.
- **Location**: Tests are in `tests/`.
- **Verification**: Use `npm run verify` to check deployment status via the helper script.

## 🎨 Style & Conventions
- **File Edits**: Always read the file in its entirety (or the relevant section) immediately before performing any edit to ensure context is current and minimize errors.
- **Verification**: Always run `npm run build` and verify it succeeds before performing any `git commit`.
- **UI/UX**: Follow `washodo_style_guide.md` for the status page (Dark Mode, Washodo Purple `#a970ff`, Sky Blue `#38bdf8`).
- **Admin UI**: Maintain consistent table layouts. Use `.col-toggle` and `.text-center` for toggle columns to prevent layout shifting.
- **Destructive Actions**: All destructive actions (e.g., "Remove" or "Delete" buttons) must be preceded by a confirmation dialog to prevent accidental data loss.
- **Notifications**: Do not use browser `alert()` calls to notify users. Use in-page, stylized notification elements (toasts, banners, or status messages) to provide feedback.
- **Modals**: Avoid using modals for complex forms or previews. Prefer dedicated pages or in-page expandable sections to improve accessibility, readability, and maintainability.
- **Planning**: Technical plans and feature progress are tracked in the `/goals` directory.
