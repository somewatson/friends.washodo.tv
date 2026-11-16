# Goal: Fix Mattermost Live Notifications

## Problem
Users are receiving Discord notifications when streamers go live, but Mattermost notifications are not being sent. The "Test" button in the Admin Panel works, indicating that the API credentials and connectivity are correct, but the automated "Live" alerts are missing.

## Investigation & Hypothesis
The `MattermostNotifier.notify` method is responsible for sending live alerts. Potential causes:
1. **Notification Cooldown/State**: The `stateRepo.shouldNotify` check may be returning `false` incorrectly, preventing the notification from firing.
2. **Database State**: Streamers might be marked as "notified" in the database, suppressing new alerts.
3. **Race Conditions**: While `initializeServers()` is called, there might be an issue with how `servers` are loaded or filtered.
4. **Silent Failures**: Errors during the `axios.post` loop might be suppressed by the `LogThrottler` or caught without sufficient logging.

## Action Plan
1. **Log Audit**: Add temporary verbose logging to `src/services/mattermost.notifier.ts` in the `notify` method to trace:
    - Whether `initializeServers()` finds servers.
    - The result of `stateRepo.shouldNotify`.
    - Whether the code reaches the `axios.post` call.
2. **State Repository Review**: Examine `src/streamerStateRepository.ts` to see how `shouldNotify` and `recordNotification` are implemented for the 'mattermost' provider.
3. **Verification**: Trigger a live state for a streamer and monitor logs to find exactly where the process stops.
4. **Admin Panel Improvements (Debuggability)**:
    - Implement a "Notification History" log in the database and Admin UI.
    - Add a "Force Reset Notification State" button for specific streamers in the Admin UI.

## Success Criteria
- Mattermost notifications are sent immediately when a streamer goes live.
- Recurring notifications fire according to the configured interval.
- Admin panel provides visibility into why a notification was or was not sent.
