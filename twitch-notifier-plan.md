# Project Plan: Mattermost Twitch Live Notifier

## 1. Overview
The goal is to create a background service (Bot/Mod) that monitors specific Twitch streamers and posts a notification to a Mattermost channel the moment they go live.

### Architecture Decision
- **Type:** Standalone Bot (Mod).
- **Reasoning:** Easier deployment on ARM, language agnostic, no risk to Mattermost server stability, and simpler update cycle.
- **Language/Framework:** Node.js with TypeScript.
- **Monitoring Method:** Polling (initial phase) for ease of setup and ARM compatibility.

## 2. Technical Specification

### Tech Stack
- **Runtime:** Node.js (LTS)
- **Language:** TypeScript
- **HTTP Client:** `axios`
- **Scheduling:** `node-cron`
- **Configuration:** `dotenv`
- **Deployment:** Docker (ARM64 compatible)

### Key Components
1. **Twitch Client:** Handles OAuth2 authentication and queries the Twitch `streams` API.
2. **State Manager:** A simple local store (JSON file or lightweight DB) to track the "last known status" of streamers to prevent duplicate notifications.
3. **Mattermost Notifier:** Sends formatted messages via Mattermost Incoming Webhooks.
4. **Scheduler:** Triggers the check cycle every 2–5 minutes.

## 3. Implementation Roadmap

### Phase 1: Infrastructure & Setup
- [ ] Create Twitch Developer Application (get `Client ID` and `Client Secret`).
- [ ] Configure Mattermost Incoming Webhook for the target channel.
- [ ] Initialize Node.js project with TypeScript and necessary dependencies.
- [ ] Set up `.env` for secret management.

### Phase 2: Core Development
- [ ] **Twitch API Integration:** Implement token fetching and "Live Status" check.
- [ ] **Notification Engine:** Implement the Mattermost Webhook POST request with formatted markdown.
- [ ] **State Tracking:** Implement logic to detect the transition from `offline` $\rightarrow$ `online`.
- [ ] **Polling Loop:** Implement the cron job to automate checks.

### Phase 3: ARM Deployment
- [ ] Create a `Dockerfile` using an ARM-compatible base image (e.g., `node:alpine`).
- [ ] Test deployment on ARM environment.
- [ ] Set up process management (e.g., `pm2` or systemd) for auto-restart.

## 4. Configuration Parameters
The following variables will be required in the `.env` file:
- `TWITCH_CLIENT_ID`: From Twitch Dev Portal.
- `TWITCH_CLIENT_SECRET`: From Twitch Dev Portal.
- `MATTERMOST_WEBHOOK_URL`: From Mattermost Integration settings.
- `TRACKED_STREAMERS`: Comma-separated list of Twitch usernames.
- `CHECK_INTERVAL`: Frequency of checks (e.g., `*/5 * * * *` for every 5 mins).

## 5. Future Enhancements
- **EventSub Migration:** Move from polling to Webhooks for real-time notifications (requires public IP/Reverse Proxy).
- **Dynamic User List:** Allow adding/removing streamers via Mattermost slash commands.
- **Customizable Alerts:** Allow different channels for different streamers.
