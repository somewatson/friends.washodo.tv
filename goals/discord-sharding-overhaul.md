# Goal: Discord Sharding Overhaul

## Objective
Replace the current `ShardingManager` implementation with a direct Multi-Client architecture to eliminate process overhead and simplify communication between the main application and Discord bots.

## Problem Statement
The current use of `ShardingManager` is overkill for the application's scale. It spawns a separate Node.js process for every bot token, leading to:
- High memory and CPU usage.
- Complex and slow IPC communication via `broadcastEval`.
- Fragile state management and difficult debugging.

## Proposed Solution
Migrate to a system where `discord.js.Client` instances are managed directly within the main process.

### Key Changes
1. **Architecture Shift**: 
   - Remove `ShardingManager`.
   - Use a `Map<string, Client>` in `DiscordSessionManager`.
   - Eliminate the separate `bot.js` process.
2. **API Simplification**:
   - Replace all `broadcastEval` calls in `DiscordNotifier` with direct method calls on the `Client` objects.
3. **Resource Optimization**:
   - Reduce the number of active Node.js processes from $N+1$ to 1.
4. **Session Management**:
   - Simplify login flows using standard `client.login()`.

## Implementation Roadmap
- [ ] Document the new architecture in `src/services/discord/README.md`.
- [ ] Update `AGENTS.md` with the overhaul plan.
- [ ] Refactor `DiscordSessionManager` to handle direct `Client` instantiation and login.
- [ ] Refactor `DiscordNotifier` to remove `broadcastEval` and use direct client references.
- [ ] Remove obsolete `bot.js` and associated session-data environment logic.
- [ ] Verify stability and resource usage.
