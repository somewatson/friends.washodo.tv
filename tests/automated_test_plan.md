# Automated Test Plan for Implemented Features

This document outlines the automated tests to be written for features that have already been implemented in the codebase. These tests will focus on verifying existing behavior without altering the production code.

## 1. Analytics & Favicon (Static Assets)
**Implemented Status:** Verified in `public/index.html`.
- [ ] **Test: Umami Script Presence**
    - **Objective:** Verify that the Umami analytics script is present in the HTML head with the correct `data-website-id`.
    - **Method:** Read `public/index.html` and assert the presence of the script tag.
- [ ] **Test: Favicon Link Presence**
    - **Objective:** Verify that the favicon link tag is present and points to `/favicon.png`.
    - **Method:** Read `public/index.html` and assert the presence of the link tag.

## 2. Discord Integration
**Implemented Status:** Verified in `src/services/discord.notifier.ts`.
- [ ] **Test: Config Parsing**
    - **Objective:** Verify that `DISCORD_BOTS` environment variable (token|channelId) is parsed correctly into internal config objects.
    - **Method:** Unit test `DiscordNotifier` by mocking `process.env` and inspecting the `configs` array.
- [ ] **Test: Command Handling (Logic)**
    - **Objective:** Verify that `handleCommand` correctly identifies commands like `!help`, `!status`, `!schedule`, `!streamers`, and `!check`.
    - **Method:** Unit test `handleCommand` by mocking the `message` object and asserting the response sent via `message.reply`.
- [ ] **Test: Notification Dispatch Logic**
    - **Objective:** Verify that `notify()` checks the `stateRepo` before sending and sends a rich embed via the Discord client.
    - **Method:** Mock `stateRepo.shouldNotify`, `Discord.Client`, and `EmbedBuilder`. Assert that `channel.send` is called only when `shouldNotify` is true.

## 3. Interactive Bot (Mattermost)
**Implemented Status:** Verified in `src/services/interactive.receiver.ts`.
- [ ] **Test: Webhook Token Validation**
    - **Objective:** Verify that `/mattermost/webhook` only accepts requests with a valid token from `MATTERMOST_BOTS`.
    - **Method:** Use `supertest` to send POST requests with valid and invalid tokens; assert 200 OK vs 401 Unauthorized.
- [ ] **Test: Command Routing**
    - **Objective:** Verify that the bot responds correctly to `!help`, `!status`, `!schedule`, `!streamers`, and `!check`.
    - **Method:** Use `supertest` to send commands via the webhook; mock the `axios.post` call to the Mattermost API and assert the message content.
- [ ] **Test: Truth-Confirming Logic**
    - **Objective:** Verify that messages containing both "true" and "?" trigger the specific "Of course..." response.
    - **Method:** Send a webhook payload with "Is this true?" and assert the response.

## 4. State Management (SQLite)
**Implemented Status:** Verified in `src/services/state.manager.ts`.
- [ ] **Test: Database Persistence**
    - **Objective:** Verify that `setLive` and `isLive` correctly persist and retrieve streamer status.
    - **Method:** Use a temporary SQLite database; set a streamer to live and assert `isLive` returns true.
- [ ] **Test: Notification Timestamping**
    - **Objective:** Verify that `setLastNotificationTime` and `getLastNotificationTime` work correctly.
    - **Method:** Set a timestamp for a user and assert the retrieved value matches.
- [ ] **Test: Migration Logic**
    - **Objective:** Verify that `load()` correctly adds the `last_notification_at` column if it is missing.
    - **Method:** Initialize `StateManager` with a schema missing the column and verify it is added after `load()`.

## 5. Core Twitch Notifier
**Implemented Status:** Verified in `src/clients/twitch.client.ts` and `src/services/webhook.service.ts`.
- [ ] **Test: Twitch API Client (Mocked)**
    - **Objective:** Verify that `getStreamStatus` correctly parses Twitch API responses into a simplified status list.
    - **Method:** Mock the Twitch API response and assert the output of `getStreamStatus`.
- [ ] **Test: Webhook Notification Payload**
    - **Objective:** Verify that `WebhookNotifier.sendNotification` sends the correctly formatted JSON payload to the configured URLs.
    - **Method:** Mock `axios.post` and assert the payload contains the expected streamer details.
