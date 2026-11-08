# Agent Instructions: TwitchWatch

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
- **Network Resilience**: 
  - All HTTP calls **must** have explicit timeouts (default 10s).
  - Use exponential backoff for retries to avoid hammering unreachable servers.
  - Avoid unbounded `Promise.all()` on network requests; use batching or sequential processing.
  - **Isolation**: Ensure failures in one external service (e.g., Mattermost) do not block or cancel requests to others (e.g., Discord).
- **Observability & I/O**:
  - **Avoid log storms**: Do not log every single failure in tight loops. Implement throttled, deduplicated, or summarized logging to prevent disk I/O spikes that can trigger filesystem read-only locks.
- **Entrypoints**:
  - `src/index.ts`: Application bootstrap and cron scheduler.
  - `src/server.ts`: API server for external status checks.
  - `src/clients/twitch.client.ts`: Wrapper for Twitch API interactions.

## ⚙️ Configuration & Env
- **Env Template**: `.env.example`
- **Key Variables**:
  - `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`: Required for Twitch API.
  - `TRACKED_STREAMERS`, `WASHODO_MEMBERS`, `WASHODO_FRIENDS`: Comma-separated lists of streamers to monitor.
  - `MATTERMOST_BOTS`: Format `token|url|channelId, ...`
  - `API_KEY`: Used for `X-API-KEY` header authentication on `/api/status/:username`.

## 🧪 Testing Quirks
- **Framework**: `jest` with `ts-jest`.
- **Location**: Tests are in `tests/`.
- **Verification**: Use `npm run verify` to check deployment status via the helper script.

## 🎨 Style & Conventions
- **UI/UX**: Follow `washodo_style_guide.md` for the status page (Dark Mode, Washodo Purple `#a970ff`, Sky Blue `#38bdf8`).
- **Planning**: Technical plans and feature progress are tracked in the `/goals` directory.
