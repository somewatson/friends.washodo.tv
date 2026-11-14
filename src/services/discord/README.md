# Discord Service Architecture

## Overview
The Discord service is responsible for sending notifications to various channels and managing bot sessions. It is designed to support multiple bot tokens to allow flexibility in where notifications are sent.

## Multi-Client Architecture
Unlike large-scale bots that require sharding across multiple processes, this service uses a **Multi-Client Architecture**. 

### Why not ShardingManager?
We previously used `ShardingManager`, which spawned a separate Node.js process for every bot. This was inefficient for our scale, causing:
- Excessive memory usage.
- Complex IPC (Inter-Process Communication) via `broadcastEval`.
- Increased latency for simple API calls.

### Current Design
- **Single Process**: All Discord clients run within the main application process.
- **Client Registry**: `DiscordSessionManager` maintains a `Map` of active `discord.js.Client` instances keyed by their tokens.
- **Direct Access**: `DiscordNotifier` retrieves the client instance directly from the manager, allowing synchronous access to the Discord API without the need for remote evaluation.

## Key Components
- `DiscordNotifier`: The high-level service that handles notification logic, rate limiting, and API interaction.
- `DiscordSessionManager`: Handles the lifecycle of Discord clients (login, heartbeat, and session tracking).
- `DiscordCommandHandler`: Manages bot commands received from Discord.

## Development Guidelines
- **Do not re-introduce `ShardingManager`** unless the bot scale reaches the thousands of guilds threshold where gateway limits necessitate true sharding.
- **Avoid blocking the event loop**: Since all clients share one process, ensure all Discord API calls are properly `await`ed and handled with timeouts.
- **Resource Management**: Ensure clients are properly destroyed or logged out when a configuration is removed to prevent memory leaks.
