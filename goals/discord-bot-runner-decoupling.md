# Goal: Decoupled Discord Bot Runner Architecture

## Objective
Separate the Discord bot clients from the main application process into a dedicated "Bot Runner" process. This prevents Discord bots from disconnecting and re-identifying every time the main application restarts during development or deployment.

## The Problem
Currently, Discord clients are instantiated within the main process. Any change to the codebase triggers a process restart (via nodemon/build), causing all bots to disconnect and perform a full `IDENTIFY` handshake. This leads to:
- High risk of hitting Discord login rate limits.
- "Bot Joined" spam in servers.
- Slower startup times for the main application.
- Fragile session resumption attempts using private library internals.

## The Solution: Multi-Process Architecture
Move the `discord.js` clients into a separate, long-lived process.

### Architecture Components
1. **Bot Runner (`src/services/discord/bot-runner.ts`)**:
   - A standalone process that manages `discord.js.Client` instances.
   - Handles all Gateway connections, heartbeats, and `messageCreate` events.
   - Exposes a lightweight internal API (e.g., via a local HTTP server) to receive notification requests from the main app.
2. **Discord Notifier (`src/services/discord.notifier.ts`)**:
   - Refactored to be a "Proxy Client".
   - Instead of calling `client.send()`, it sends an HTTP request to the Bot Runner.
3. **Process Orchestration**:
   - Use `concurrently` in `package.json` to launch both the Main App and the Bot Runner simultaneously.

## Implementation Roadmap
- [ ] **Phase 1: Stabilization**
  - Remove all manual session persistence and private property access hacks to fix the TypeScript build.
  - Clean up `discord_sessions` table usage.
- [ ] **Phase 2: The Bot Runner**
  - Create `bot-runner.ts` to handle client lifecycles.
  - Implement an internal API for sending messages.
  - Move `DiscordCommandHandler` logic into the runner.
- [ ] **Phase 3: Notifier Refactor**
  - Update `DiscordNotifier` to communicate with the Bot Runner via HTTP.
- [ ] **Phase 4: Orchestration**
  - Update `package.json` scripts to use `concurrently`.
  - Update `AGENTS.md` and visual loop documentation.
