# Mattermost Bot Setup Guide

This guide explains how to configure Mattermost to enable the interactive features of the Twitch Notifier bot.

## 1. Prerequisites
- The bot must be deployed and running.
- You must have **System Admin** permissions in Mattermost or have Outgoing Webhooks enabled for your account.

## 2. Bot Account Configuration
Ensure you have a Bot Account created:
1. Go to **Product Menu > Integrations > Bot Accounts**.
2. Create a bot (if not already done) and copy the **Bot Access Token**.
3. Add this token to your bot's `.env` file as `MATTERMOST_BOT_TOKEN`.
4. **Schedule Text**: Add the `BOT_SCHEDULE_TEXT` variable to your `.env` file to customize the message displayed by the `!schedule` command.
5. Invite the bot account to the channels where you want it to be interactive.

## 3. Outgoing Webhook Configuration
This allows Mattermost to "ping" your server when a specific word is used.

1. Go to **Product Menu > Integrations > Outgoing Webhook**.
2. Select **Add Outgoing Webhook**.
3. **Name**: `Twitch Bot Receiver`
4. **Description**: `Handles interactive commands for the Twitch Notifier`.
5. **Channel**: Select the public channel(s) you want the bot to monitor.
6. **Trigger Words**: Enter the trigger word (e.g., `!bot` or the bot's username).
7. **Content Type**: Select `application/x-www-form-urlencoded`.
8. **Callback URLs**: 
    - Check your bot's startup logs. You will see a line: `🚀 Mattermost Outgoing Webhook ready at: <URL>`.
    - Copy that URL and paste it here.
9. Select **Save**.

## 4. Security Token Setup
1. After saving the webhook, Mattermost will display a **Token**.
2. Copy this token.
3. Add it to your bot's `.env` file as `MATTERMOST_OUTGOING_TOKEN`.
4. Restart the bot for the changes to take effect.

## 5. Testing
In the configured channel, type:
`!bot !help` (Replace `!bot` with your trigger word).

The bot should respond with its help menu.
