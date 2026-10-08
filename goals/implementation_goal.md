# Implementation Plan: Dynamic Thumbnail Endpoint

## Objective
Replace direct Twitch thumbnail URLs in notifications with a dynamic endpoint hosted on our server. This ensures that a valid image is always shown, switching from a live screengrab to a branded "Offline" profile image when the stream ends.

## Technical Strategy

### 1. New API Endpoint
Add a route `GET /api/thumbnail/:username` to `ApiServer`.
- **Live State**: 
    - Query `StreamerStateRepository` for the `last_thumbnail_url`.
    - Perform a `302 Redirect` to the Twitch thumbnail URL (with `{width}` and `{height}` replaced).
- **Offline State**:
    - Fetch the user's `profile_image_url` (via `TwitchClient` or cached in DB).
    - Return an **SVG image** as the response.
    - **Important**: To avoid CORS/rendering issues with external images in SVGs, the profile picture should be fetched by the server and embedded directly into the SVG as a **Base64 data URI**.
    - The SVG will embed the profile picture and overlay it with an "OFFLINE" badge.

### 2. SVG Design for Offline State
The SVG will be a $400 \times 225$ canvas:
- Background: Dark grey/black.
- Center: Profile picture (clipped to a circle or square).
- Overlay: A semi-transparent "OFFLINE" banner or badge.

### 3. Notifier Update
Modify `WebhookNotifier.sendNotification` to stop using Twitch URLs and instead use:
`https://friends.washodo.tv/api/thumbnail/${streamer.user_login}`

## Implementation Steps
1. [ ] Update `StreamerStateRepository` to ensure `profile_image_url` is persisted (if not already).
2. [ ] Implement the `/api/thumbnail/:username` route in `ApiServer`.
3. [ ] Create the SVG generator logic for the offline state.
4. [ ] Update `WebhookNotifier` to use the new dynamic URL.
5. [ ] Test live and offline transitions.
