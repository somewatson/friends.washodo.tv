# Implementation Plan: Notification Loop (Threaded Offline Replies)

## Objective
Instead of sending a separate "Offline" notification in the main channel, the bot will reply to the original "Live" notification in a thread once a streamer has been offline for at least 4 minutes. This closes the information loop without spamming the main channel.

## Technical Strategy

### 1. Database Schema Updates (`src/streamerStateRepository.ts`)
We need to track the original post ID and the last time the streamer was confirmed live.
- **Table `streamer_status` changes**:
    - Add `last_notification_post_id` (TEXT): Stores the Mattermost Post ID of the "Live" notification.
    - Add `last_seen_live` (TEXT): Timestamp of the last time the user was detected as live.
- **Repository Method Additions**:
    - `setNotificationPostId(username, postId)`
    - `getNotificationPostId(username)`
    - `updateLastSeenLive(username, timestamp)`
    - `getLastSeenLive(username)`

### 2. Notifier Enhancements (`src/webhookNotifier.ts`)
The notification process must transition from "fire-and-forget" to "track-and-reply".
- **`sendNotification`**: 
    - Update to return the `id` of the created post from the Mattermost API response.
- **New Method `sendThreadedOfflineNotification(username, rootPostId, channelId)`**:
    - Call `POST /api/v4/posts`.
    - Set `root_id` to `rootPostId`.
    - Set `message` to `💤 **${username}** is now offline.`

### 3. Orchestration Logic (`src/index.ts`)
Modify the `checkStreams` loop to handle the 4-minute grace period and the threaded reply.
- **When a streamer goes Live**:
    - Call `sendNotification`.
    - Save the returned `postId` using `stateRepo.setNotificationPostId`.
- **When a streamer is NOT live**:
    - If they were previously `is_live = 1`:
        - Update `last_seen_live` to the current timestamp.
        - Check if `(current_time - last_seen_live) >= 4 minutes`.
        - If the threshold is met:
            - Retrieve `last_notification_post_id`.
            - Call `notifier.sendThreadedOfflineNotification`.
            - Call `stateRepo.setOffline(username)`.
            - Clear `last_notification_post_id`.

## Implementation Steps
1. [ ] Update `StreamerStateRepository` schema and add helper methods.
2. [ ] Update `WebhookNotifier` to return Post IDs and implement the threaded reply method.
3. [ ] Update `src/index.ts` to save Post IDs and implement the 4-minute offline delay logic.
4. [ ] Test the end-to-end flow: Live Notification $\rightarrow$ 4 min wait $\rightarrow$ Threaded Reply.
