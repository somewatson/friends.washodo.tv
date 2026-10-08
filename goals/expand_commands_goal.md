# Project Goal: Expand Bot Interactive Commands

## 1. Overview
The objective is to expand the interactive capabilities of the Mattermost bot by adding commands that allow users to query streamer statuses and view the community schedule.

## 2. Technical Specification

### Environment Configuration
- **`BOT_SCHEDULE_TEXT`**: A new environment variable containing the current schedule message.
  - *Initial Value:* "The Washodo gang are making a content house in Japan in March 2027! Support them by tuning into their streams from now until then! Collabs every Friday at 9PM PST and Sunday at 12PM PST. Check out the Twitch team!"

### New Commands
1. **`!streamers`**: 
    - Fetches all `TRACKED_STREAMERS`.
    - Queries the `TwitchClient` for current live status.
    - Returns a formatted list with indicators (🔴 Live / ⚪ Offline).
2. **`!check <username>`**:
    - Parses the provided username.
    - Queries `TwitchClient` for that specific user's status.
    - Returns a detailed response with a link to the channel if live.
3. **`!schedule`**:
    - Returns the text stored in `BOT_SCHEDULE_TEXT`.

### Architectural Changes
- **`InteractiveReceiver`**:
    - Inject `TwitchClient` into the receiver to allow real-time API queries.
    - Update `handleCommand` logic to support argument parsing for the `!check` command.
    - Update the `!help` menu to include the new commands.

## 3. Implementation Roadmap

### Phase 1: Environment & Configuration
- [ ] Add `BOT_SCHEDULE_TEXT` to `.env` and `.env.example`.
- [ ] Update `docs/mattermost-setup.md` to document the new variable.

### Phase 2: Feature Development
- [ ] Modify `InteractiveReceiver` to accept `TwitchClient` in the constructor.
- [ ] Implement `!streamers` logic.
- [ ] Implement `!check <username>` logic with argument parsing.
- [ ] Implement `!schedule` logic.
- [ ] Update `!help` response.

### Phase 3: Integration & Testing
- [ ] Update `src/index.ts` to pass the `TwitchClient` instance to the `InteractiveReceiver`.
- [ ] Verify all commands return correct data from the Twitch API.
- [ ] Verify `!schedule` returns the exact configured text.

## 4. Success Criteria
- `!streamers` correctly lists all tracked users and their current status.
- `!check <name>` accurately reports if a specific user is live.
- `!schedule` displays the specified schedule message.
- The `!help` command reflects all current capabilities.
- The project builds without errors.
