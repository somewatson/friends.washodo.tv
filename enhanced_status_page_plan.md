# Plan: Enhance Streamer Status Page with Detailed Info

## Objective
Upgrade the server-rendered status page to show detailed streamer information, including profile pictures, stream thumbnails, descriptions, and direct links to their channels.

## Implementation Details

### 1. Backend Enhancements (`src/server.ts` & `src/twitchClient.ts`)
- **Expand API Data**: Ensure the Twitch API calls retrieve the following fields:
    - `user_login` (Username)
    - `profile_image_url` (Avatar)
    - `thumbnail_url` (Live preview image)
    - `title` (Stream title/description)
- **Update SSR Logic**: Modify the `renderGrid` function in `src/server.ts` to incorporate these new data points into the generated HTML string.

### 2. UI/UX Updates (`public/index.html`)
- **Styling Improvements**: Update the CSS to handle a richer card layout:
    - **Avatars**: Add styling for circular profile images.
    - **Thumbnails**: Add styling for live stream previews (with a "LIVE" overlay).
    - **Typography**: Add styling for a smaller, muted description text.
    - **Interactive Elements**: Style the cards to look clickable (hover effects).
- **HTML Structure Changes**:
    - Wrap the entire card or the name/image in an `<a>` tag linking to `https://twitch.tv/${username}`.
    - Display the `profile_image_url` for all streamers.
    - Display the `thumbnail_url` and `title` specifically for streamers who are currently live.

### 3. Verification Steps
- **Data Check**: Use `curl` to verify that the server is successfully processing the additional Twitch API fields.
- **Visual Audit**: Ensure the layout remains responsive and clean with the added images and text.
- **Link Check**: Verify that all streamer cards correctly redirect to their respective Twitch channels.
