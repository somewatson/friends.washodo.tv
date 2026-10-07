# TwitchWatch

TwitchWatch is a lightweight Node.js/TypeScript hybrid service that monitors Twitch streamers, notifies multiple webhook endpoints or Mattermost Bot accounts when they go live, and provides a secure API for external websites (e.g., www.washodo.tv) to check streamer status and current uptime.

## 🚀 Quick Start Guide

To get TwitchWatch running, follow these simple steps:

### 1. Obtain Twitch API Keys
1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console).
2. Register a new Application.
3. Set the OAuth Redirect URL to `http://localhost`.
4. Copy your **Client ID** and **Client Secret**.

### 2. Configure Notifications

#### Option A: Standard Webhooks
1. Open your webhook provider (e.g., Mattermost, Discord).
2. Go to **Main Menu** $\rightarrow$ **Integrations** $\rightarrow$ **Incoming Webhooks**.
3. Click **Add Incoming Webhook**, select the channel, and copy the **Webhook URL**.

#### Option B: Mattermost Bot Accounts (Advanced)
Bot accounts allow for more robust integration and multi-server support.
1. Go to **System Console** $\rightarrow$ **Integrations** $\rightarrow$ **Bot Accounts** and enable bot account creation.
2. Create a bot account, copy the **Access Token**, and invite the bot to your desired channels.
3. Note the **Channel ID** of the channel where the bot should post.

### 3. Configure Environment
Create a file named `.env` in the root directory (use `.env.example` as a template).

```env
# Twitch API Credentials
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here

# Standard Webhooks (Comma-separated)
WEBHOOK_URLS=url1,url2

# Mattermost Bots (Format: token|url|channelId, ...)
# Example: token1|https://mattermost.server1.com|channel123,token2|https://mattermost.server2.com|channel456
MATTERMOST_BOTS=

# Database Path (for persistent state)
DATABASE_PATH=/app/data/streamers.db

# API Security
API_KEY=generate_a_long_random_string_here

# Bot Settings
TRACKED_STREAMERS=streamer1,streamer2
CHECK_INTERVAL=*/5 * * * *

# API Server Port
PORT=3000
```

## 🛠 Installation & Running

### Docker Compose (Recommended)
TwitchWatch is optimized for ARM64 and x86. 
```bash
docker-compose up -d
```
*This will build the image, persist the streamer state in a local `./data` volume, and start the service.*

### Local Development
```bash
npm install
npm test          # Run the test suite
npm run build     # Compile TypeScript
npm start         # Start the service
```

## 🔌 API & Status Page

TwitchWatch provides a status page and a secure API to check if a user is live.

**Endpoint:** `GET /api/status/:username`
**Authentication:** Must include the `X-API-KEY` header.

The status page now includes **Real-time Uptime**, calculating exactly how long a streamer has been live based on Twitch's broadcast start time.

### Example Response:
```json
{
  "username": "ninja",
  "isLive": true,
  "uptime": "2h 15m"
}
```

## 🤖 GitHub CI Setup

This project includes a GitHub Actions workflow to automatically test and verify your code. Push to GitHub to enable CI.

## 📜 Credits

This project was created by [Somewatson](https://somewatson.com), a member of [Washodo.tv](https://www.washodo.tv), with the assistance of [opencode](https://opencode.ai), an AI software engineering agent.

## 📄 License

This project is licensed under the MIT License.
