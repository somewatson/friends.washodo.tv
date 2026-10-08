# Discord Setup Guide

This guide explains how to set up the Discord bots for the Twitch Notifier.

## 1. Create a Discord Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give it a name (e.g., "Twitch Notifier").
3. Go to the **Bot** tab on the left sidebar.
4. Click **Reset Token** (or **Copy**) to get your **Bot Token**. Save this securely.

## 2. Configure Permissions
In the **Bot** tab, scroll down to **Privileged Gateway Intents**.
- Enable **Presence Intent** (optional, but recommended).
- Enable **Server Members Intent** (optional, but recommended).
- Enable **Message Content Intent** (REQUIRED if the bot needs to read messages).

## 3. Invite the Bot to Your Server
1. Go to the **OAuth2** $\rightarrow$ **URL Generator** tab.
2. Select the `bot` scope.
3. Select the following permissions:
    - `Send Messages`
    - `Embed Links`
4. Copy the generated URL, paste it into your browser, and invite the bot to your server.

## 4. Get the Channel ID
1. In Discord, go to **User Settings** $\rightarrow$ **Advanced**.
2. Enable **Developer Mode**.
3. Right-click the channel where the bot should post and select **Copy Channel ID**.

## 5. Configure Environment Variables
Add the tokens and channel IDs to your `.env` file using the pipe-delimited format:

`DISCORD_BOTS=TOKEN_1|CHANNEL_ID_1,TOKEN_2|CHANNEL_ID_2`

Example:
`DISCORD_BOTS=MTAyMzQ1Njc4OQ.Xyz.Abc123|123456789012345678,OTg3NjU0MzIx.Def.Ghi456|876543210987654321`
