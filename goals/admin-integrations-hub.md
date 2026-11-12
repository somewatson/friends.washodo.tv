# Goal: Admin Panel Integrations Hub & Twitch Bot Automation

## Overview
Transform the current administrative interface into a comprehensive **Integrations Hub**. This involves creating dedicated configuration pages for Discord, Mattermost, and Twitch, providing high-quality onboarding documentation for admins, and implementing an automated promotional system for the Twitch Chat Bot. Additionally, implement a **Lead Generation System** to capture new user signups and a **Webhooks Manager** for internal notifications.

## 1. Admin Panel: Integrations Hub
The goal is to move away from scattered configuration and create a centralized "Integrations" section in the Warden Admin Panel.

### A. Discord Configuration Page
- **Fields**:
    - Bot Token
    - Client ID
    - Client Secret
    - Base URL
- **Documentation & Guidance**:
    - **Primary Call-to-Action**: A banner recommending the "Add Bot" OAuth flow from the homepage as the easiest method.
    - **Manual Setup Guide**: A help section (modal or expandable) detailing:
        1. Creating an application in the [Discord Developer Portal](https://discord.com/developers/applications).
        2. Obtaining the Bot Token via the "Bot" tab.
        3. Enabling "Message Content Intent".
        4. Copying Client ID and Secret from the "OAuth2" tab.

### B. Mattermost Configuration Page
- **Fields**:
    - Server URL
    - Webhook Token
    - Bot Access Token
    - Default Channel ID
- **Documentation & Guidance**:
    - **Manual Setup Guide**: A step-by-step guide detailing:
        1. **Webhooks**: Main Menu $\rightarrow$ Integrations $\rightarrow$ Incoming Webhooks.
        2. **Bot Accounts**: Main Menu $\rightarrow$ Integrations $\rightarrow$ Bot Accounts.
        3. **Channel ID**: Instructions on extracting the ID from the browser URL.
        4. **Reference**: Link to official Mattermost Bot documentation.

### C. Twitch Configuration Page (New)
- **Fields**:
    - Bot Username (`TWITCH_CHAT_BOT_USERNAME`)
    - Bot OAuth Token (`TWITCH_CHAT_BOT_TOKEN`)
    - Client ID & Client Secret
- **Authentication Flow (Hybrid Approach)**:
    - **Automated OAuth**: A "Connect Twitch Bot" button that initiates a User OAuth flow (redirecting the admin to Twitch to authorize the bot account).
    - **Manual Override**: Fields to manually paste an OAuth token for developers who prefer external token generation.
    - **Token Management**: Implementation of a `refresh_token` system in the database to ensure the bot's access doesn't expire.
- **Features**:
    - **Granular Broadcast Control**: Instead of a global toggle, implement a channel selector.
        - **User Flow**: Categorized inline lists (Twitch, Discord, Mattermost) with checkboxes for individual channel/guild selection.
        - **UX**: Include "Select All/None" quick-toggles, an inline search/filter bar for long lists, and a real-time "Current Targets" summary to avoid modals or dialogs.
- **Documentation & Guidance**:
    - Instructions on generating a User OAuth Token with `chat:edit` and `chat:read` scopes.

---

## 2. Twitch Bot: Promotional & Command Logic
The Twitch bot will transition from a simple message sender to an interactive engagement tool.

### A. Automated Broadcasts
- **Integration**: Link the `TwitchChatClient` to the existing Broadcast scheduler.
- **Logic**: When a broadcast is scheduled and triggered, the bot will iterate through currently live tracked streamers and post the message in their respective chats.

### B. Custom Chat Commands
Implement a command handler within the `TwitchChatClient` to respond to the following:

| Command | Response/Logic | Purpose |
| :--- | :--- | :--- |
| `!washodo` | Randomized promotional blurb + link to Washodo. | Direct Promotion |
| `!status` | List of currently live tracked streamers. | Utility |
| `!discord` | Official Discord invite link. | Conversion |
| `!help` | List of all available bot commands. | UX |
| `!follow` | Prompt to follow the streamer and join Washodo. | Engagement |
| `!shoutout <user>`| Formatted community praise message. | Community |

**Constraint**: Implement basic cooldowns (e.g., 5 minutes per user for promo commands) to prevent spam.

---

## 3. Lead Generation & Internal Webhooks
Implementing a "SaaS-Lite" funnel to capture leads and notify the admin in real-time.

### A. Frontend Conversion Path
- **Homepage Signup**: Simple form for Name, Email, and Plan selection.
- **Pricing Page**: A dedicated page featuring three tiers:
    1. **Free**: Ad-supported, `subdomain.washodo.tv`.
    2. **Basic ($8/mo)**: Ad-free, `subdomain.washodo.tv`.
    3. **Professional**: Custom domain, "Contact Us" pricing.

### B. Backend Lead Capture
- **Persistence**: A new `signups` table in SQLite (`full_name`, `email`, `selected_plan`, `created_at`, `status`).
- **API**: `/api/signup` endpoint to handle and validate submissions.

### C. Internal Webhooks Manager
- **Admin UI**: A new page to manage internal webhooks.
- **Functionality**: Ability to map "Events" (e.g., `user.signup`) to specific target URLs.
- **Integration**: When a user signs up, the system triggers a POST request to the configured webhooks (e.g., notifying a Mattermost channel).

---

## 4. Technical Implementation Plan

### Phase 1: Backend & Persistence
- **Schema**: Update `streamerStateRepository.ts` to create/manage tables for `integration_configs`, `bot_commands`, `signups`, and `internal_webhooks`.
- **API**: Create new endpoints in `src/server.ts` for:
    - Loading/saving integration settings.
    - Processing signups (`/api/signup`).
    - Managing internal webhooks.

### Phase 2: Frontend UI
- **Navigation**: Update the admin sidebar to include "Integrations", "Leads", and "Webhooks".
- **Pages**: Build the three config pages, the Pricing page, and the Homepage form.
- **UX**: Ensure compliance with the `washodo_style_guide.md` (Dark Mode, Washodo Purple, responsive layouts).

### Phase 3: Bot Logic & Notification Integration
- **Command Handler**: Enhance `TwitchChatClient` to listen for messages and execute command logic.
- **Broadcast Bridge**: Implement the bridge between the Broadcast service and the Chat Client.
- **Webhook Dispatcher**: Implement the logic to trigger external POST requests upon internal events.
- **Bootstrap**: Update `src/index.ts` to ensure the bot and dispatcher start upon application launch.
