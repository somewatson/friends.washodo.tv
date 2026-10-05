# TwitchWatch

TwitchWatch is a lightweight Node.js/TypeScript hybrid service that monitors Twitch streamers, notifies a Mattermost channel when they go live, and provides a secure API for external websites (e.g., www.washodo.tv) to check streamer status.

## 🚀 Quick Start Guide

To get TwitchWatch running, follow these simple steps:

### 1. Obtain Twitch API Keys
1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console).
2. Register a new Application.
3. Set the OAuth Redirect URL to `http://localhost`.
4. Copy your **Client ID** and **Client Secret**.

### 2. Create Mattermost Webhook
1. Open your Mattermost server.
2. Go to **Main Menu** $\rightarrow$ **Integrations** $\rightarrow$ **Incoming Webhooks**.
3. Click **Add Incoming Webhook**.
4. Select the channel where notifications should be posted.
5. Copy the **Webhook URL**.

### 3. Configure Environment
Create a file named `.env` in the root directory. You can use `.env.example` as a template. Replace the placeholders with your actual values:

```env
# Twitch API Credentials
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here

# Mattermost Notification Configuration
MATTERMOST_WEBHOOK_URL=your_webhook_url_here

# API Security (used by your website to authenticate)
API_KEY=generate_a_long_random_string_here

# Bot Settings
# Comma-separated list of Twitch usernames to monitor for notifications
TRACKED_STREAMERS=streamer1,streamer2,streamer3

# How often to check Twitch (Cron expression: */5 * * * * means every 5 mins)
CHECK_INTERVAL=*/5 * * * *

# API Server Port
PORT=3000
```

## 🛠 Installation & Running

### Docker Compose (Recommended)
The easiest way to run TwitchWatch on ARM or x86:
```bash
docker-compose up -d
```
*This will build the image, set up the network, and start the service in the background.*

### Local Development
```bash
npm install
npm test          # Run the test suite
npm run build     # Compile TypeScript to JavaScript
npm start         # Start the service
```

### Manual Docker
```bash
docker build -t twitch-watch .
docker run -d --env-file .env -p 3000:3000 twitch-watch
```

## 🔌 API Usage (for www.washodo.tv)

TwitchWatch provides a secure API to check if a user is live and when they were last seen streaming.

**Endpoint:** `GET /api/status/:username`
**Authentication:** Must include the `X-API-KEY` header.

### Example Request (using curl):
```bash
curl -H "X-API-KEY: your_secure_api_key_here" http://your-server-ip:3000/api/status/ninja
```

### Example Response:
```json
{
  "username": "ninja",
  "isLive": true,
  "lastLive": "2026-10-05T12:00:00Z"
}
```

## 🤖 GitHub CI Setup

This project includes a GitHub Actions workflow to automatically test and verify your code.

**To enable CI:**
1. Push this repository to GitHub.
2. The workflow in `.github/workflows/ci.yml` will automatically trigger on every push or pull request to `main` or `master`.
3. You can view build results under the **Actions** tab of your GitHub repository.

## 📜 Credits

This project was created by [Somewatson](https://somewatson.com), a member of [Washodo.tv](https://www.washodo.tv), with the assistance of [opencode](https://opencode.ai), an AI software engineering agent.

## 📄 License

This project is licensed under the MIT License.
