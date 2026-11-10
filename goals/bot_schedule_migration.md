# Goal: Move BOT_SCHEDULE_TEXT to Database and Warden Admin Panel

## Objective
Migrate the static `BOT_SCHEDULE_TEXT` environment variable into a structured SQLite database system and provide a high-fidelity management interface within the Warden admin panel. This allows admins to manage multiple, ordered, and time-limited announcements with platform-specific targeting and rich text editing.

## Proposed Features

### 1. Core Management & "Announcement Rows"
- **Database Persistence**: Transition from a single setting to an `announcements` table in `data/streamers.db`.
    - `id`: Primary Key.
    - `text`: The markdown content of the message.
    - `order_index`: To control the vertical sequence of messages.
    - `is_active`: Toggle to enable/disable a specific row.
    - `discord_enabled`, `mattermost_enabled`, `twitch_enabled`: Per-message platform targeting.
    - `start_date`, `end_date`: Temporal validity for time-limited events.
- **Admin Interface (The "Rows" View)**:
    - A list view of all announcements that can be reordered via drag-and-drop.
    - Ability to add, edit, and delete individual announcement rows.
- **Rich Text Editor**:
    - A dedicated editing modal for each row.
    - Markdown toolbar (Bold, Italic, Links).
    - **Live Preview**: Side-by-side rendering of how the message will appear in Discord and Mattermost.

### 2. Enhanced Functionality
- **Dynamic Placeholders**: Support "magic tags" for runtime replacement:
    - `{{today}}`: Current date.
    - `{{streamer_count}}`: Number of streamers currently live.
    - `{{team_link}}`: Link to the Twitch team page.
- **Temporal Logic**: Automatically filter out messages where the current date is outside the `start_date` and `end_date` window.

### 3. UX & Reliability
- **Confirmation Dialogs**: Destructive actions (deleting a row) require confirmation.
- **Environment Tagging**: Maintain the existing `[STAGING]` / `[DEV]` prefixing for notifications sent from non-production environments.
- **Notification Assembly**: Combine all active, valid announcement rows into a single formatted block for each notification.

## Technical Implementation Steps
1. **Database Migration**:
    - Create the `announcements` table.
    - Implement CRUD methods in `StreamerStateRepository` to handle these rows.
2. **Backend Update**:
    - Create API endpoints in `src/server.ts` for listing, creating, updating, deleting, and reordering announcements.
    - Implement the "Assembly" logic: fetch active/valid rows $\rightarrow$ sort by index $\rightarrow$ replace placeholders $\rightarrow$ join with newlines.
    - Update the main loop in `src/index.ts` to use the assembled text.
3. **Frontend Update**:
    - Implement the draggable list in `public/admin.html`.
    - Build the rich text editing modal with a Markdown-to-HTML previewer.
    - Integrate with the new API endpoints.
4. **Verification**:
    - Verify the correct sequence of messages is delivered to enabled platforms.
    - Test date-based expiration.
    - Run `npm run build` to ensure type safety.
