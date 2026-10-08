# Twitch Chatbot Setup Guide

This guide explains how to configure and connect the Twitch Chatbot for the Washodo Stream Status system. The bot provides real-time status checks and community information directly in Twitch chat.

## 1. Create the Bot Identity (Twitch Account)

Before configuring the technical side, you need an identity for the bot.

**Important Recommendation:** Do **not** use your personal Twitch account as the bot. Instead, create a **dedicated Twitch account** (e.g., `WashodoStatusBot`). This ensures that when the bot speaks in chat, it is clearly identified as a bot and doesn't appear as if you are talking to yourself.

1.  Create a new account at [Twitch.tv](https://twitch.tv).
2.  Set up a profile picture and a bio (e.g., "Official status bot for the Washodo community").
3.  Keep the login credentials for this account handy.

## 2. Create a Twitch Developer Application

The "Application" acts as the bridge between your server and the Twitch API.

1.  Log in to the [Twitch Developer Console](https://dev.twitch.tv/console) (you can use your main account for this).
2.  Click **Register Your Application**.
3.  **Name**: `Washodo Status Bot`.
4.  **OAuth Redirect URLs**: `https://friends.washodo.tv/auth/callback`
    *   *Note: This must match exactly. If there is a trailing slash or a typo, the connection will fail with a "Redirect URI mismatch" error.*
5.  **Category**: `Chat Bot`.
6.  Click **Create**.
7.  Once created, click **Manage**.
8.  Copy the **Client ID** and generate a **Client Secret**. **Keep the secret confidential.**

## 3. Environment Configuration

Add the following variables to your `.env` file on the server:

```env
# Twitch API Credentials (From the Developer Console)
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
```

## 4. Connecting the Bot Identity

The system uses a professional OAuth2 "Authorization Code Grant" flow. You do not need to manually paste tokens into the `.env` file; you authorize the identity via the website.

1.  Start the application (`npm run start` or via your process manager).
2.  Navigate to the homepage: `https://friends.washodo.tv`.
3.  Scroll down to the **"Want to be included here?"** section.
4.  Click the **Connect Twitch Bot** button.
5.  **CRITICAL STEP**: You will be redirected to Twitch. **Log in with the dedicated Bot Account you created in Step 1**, not your personal account.
6.  Authorize the requested scopes (`chat:edit`, `chat:read`).
7.  After authorization, you will be redirected back to the status page. You should see a success toast: *"Twitch Bot connected successfully!"* and the button will change to *"Bot Connected: [bot_username]"*.

## 5. Bot Functionality

Once connected, the bot automatically joins the channels of all streamers listed in `WASHODO_MEMBERS` and `WASHODO_FRIENDS` in the environment configuration.

### Supported Chat Commands

| Command | Description |
| :--- | :--- |
| `!help` | Lists all available bot commands. |
| `!status` | Provides a link to the Washodo Status website. |
| `!streamers` | Lists all Washodo members and friends currently tracked. |
| `!check <user>` | Checks if a specific streamer is live and provides a direct link to their status page. |
| `!schedule` | Directs users to the community Discord or website for the schedule. |

## 6. Troubleshooting

### Bot not responding?
- Check the server logs for `Twitch Bot connected as [username]`.
- Ensure the Bot Account has been given permission to speak in the target channels (e.g., as a Moderator or by enabling "Followers-only" mode if applicable).
- Verify that `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are correct in the `.env` file.

### Redirect URI Error
- If you see a "Redirect URI mismatch" error on the Twitch authorization page, ensure that `https://friends.washodo.tv/auth/callback` is added exactly as written to the **OAuth Redirect URLs** in the Twitch Developer Console.
