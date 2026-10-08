# Project Goals: Fix Index Page and Add Streamer Status Features

## 1. Fix Index Page "Cannot GET /"
- **Objective**: Restore the root page functionality to show streamer statuses.
- **Tasks**:
  - Investigate the server entry point to identify why the root route is missing or failing.
  - Restore the `app.get('/')` route handler or fix the static file serving configuration.
  - Verify that the index page correctly displays streamer statuses.

## 2. Promote Website in Bot Responses
- **Objective**: Add `https://friends.washodo.tv` to bot responses to increase traffic.
- **Tasks**:
  - Locate the bot's response construction logic.
  - Implement a mechanism to append the website link to bot replies.
  - Test responses to ensure the link is presented clearly and consistently.

## 3. Implement Individual Streamer Status Pages
- **Objective**: Create dynamic pages for individual streamers (e.g., `/streamer/legitkorea`).
- **Tasks**:
  - Define a dynamic route `/streamer/:username` in the server/frontend.
  - Implement logic to fetch status data for the specific streamer requested in the URL.
  - Create a view/component to display the individual streamer's online status.
  - Implement 404/Error handling for non-existent streamers.

## 4. Resolve Server Port Conflict (Unification)
- **Objective**: Fix the conflict where both `InteractiveReceiver` and `ApiServer` try to bind to the same port (3001).
- **Tasks**:
  - Modify `InteractiveReceiver` to provide its Express app/routes instead of starting its own server.
  - Integrate `InteractiveReceiver` routes into the `ApiServer` Express application.
  - Ensure only one server instance is started in `src/index.ts` on the configured port.
  - Verify that both the website (`/`) and the Mattermost webhooks (`/mattermost/webhook`) work simultaneously.
  - **Crucial**: Ensure `express.static('public')` is placed *after* the root route handler to prevent the static `index.html` from overriding the dynamically rendered status page.

## 5. Improve Bot Context and Interaction
- **Objective**: Ensure the bot replies within the correct Mattermost thread context and add a truth-confirming interaction.
- **Tasks**:
  - Update `InteractiveReceiver` to extract `root_id` from the webhook payload.
  - Modify the response logic to include `root_id` in the API request to Mattermost, ensuring replies stay within threads.
  - Implement a check for messages containing both "true" and "?" to trigger the response: "Of course, that sounds about right!".
  - Verify thread-aware replying and the "truth" response in Mattermost.
