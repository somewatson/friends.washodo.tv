# Goal: Fix Mattermost Live Notifications

## Problem
Users are receiving Discord notifications when streamers go live, but Mattermost notifications are not being sent.

## Analysis
The `MattermostNotifier` class initializes its server configurations asynchronously in the constructor without being awaited. While the `broadcast` method explicitly calls `initializeServers()` to ensure configurations are loaded, the `notify` method (used for "Live" alerts) does not. This creates a race condition where `notify` may execute while the `servers` list is still empty, leading to skipped notifications.

## Proposed Solution
1.  **Ensure Initialization in `notify`**: Update `src/services/mattermost.notifier.ts` to call `await this.initializeServers()` at the beginning of the `notify` method.
2.  **Improve Bootstrap Flow**: Move the server initialization out of the constructor and into an explicit `init()` method that can be awaited during the application bootstrap process in `src/index.ts`, reducing redundant database calls.

## Verification Plan
1.  **Log Verification**: Check the logs for the warning `[MattermostNotifier] No servers configured in database or MATTERMOST_BOTS` during the first check cycle.
2.  **Manual Test**: Trigger a "Live" notification state and verify that the Mattermost channel receives the alert.
3.  **Regression Test**: Verify that "Broadcast" announcements still function correctly.
