# SaaS Product Plan: friends.washodo.tv

## 1. Vision
Transform the internal streamer status tool into a consumer-facing SaaS platform where Twitch streamers and viewers can track their specific circles of friends in real-time, with high-visibility widgets for growth and monetization.

## 2. Core Architecture Shift
The system must move from a static, hardcoded configuration to a dynamic, data-driven application.

### Data Model
- **Users**: Auth via Twitch OAuth, subscription status (Free/Paid), settings.
- **Groups**: Custom lists of Twitch usernames.
    - *Free Tier*: Must include the "Washodo Members" base list.
    - *Paid Tier*: Full control over group members.
- **Streamer Cache**: A centralized database table storing the latest status, thumbnails, and profile info of all tracked streamers to minimize Twitch API calls.
- **Analytics**: Track impressions and clicks per widget/group.

### Tech Stack Evolution
- **Backend**: Transition to a full API (Express) with a persistent database (PostgreSQL/MongoDB).
- **Frontend**: Implementation of a User Dashboard for group management.
- **Real-time**: Implementation of WebSockets or optimized polling for the OBS browser source.

## 3. Tiered Feature Model

| Feature | Free Tier | Paid Tier (Premium) |
| :--- | :--- | :--- |
| **Group Logic** | Must include "Washodo Members" | 100% Custom Friend Groups |
| **Streamer Limit** | Capped number of friends | Unlimited friends |
| **Customization** | Standard Washodo Themes | Custom Colors, Fonts, and Branding |
| **Privacy** | Public Widgets | Private/Password-Protected Views |
| **Analytics** | Basic view counts | Detailed engagement tracking |

## 4. Widget Ecosystem & Viral Marketing
The product grows by being visible on the platforms where the users already are.

### Distribution Channels
- **Twitch About Page**: Embeddable HTML/JS snippets for panel integration.
- **OBS Browser Source**: A dedicated, transparent overlay designed specifically for live streams. Must update in real-time without manual refreshes.
- **Social/Linktree/Email**: Dynamic "Status Badges" (small images or iframes) that show how many friends are currently live.
- **Viral Loop**: Every free widget contains a "Powered by friends.washodo.tv" link, driving new users back to the landing page.

## 5. Engagement & Analytics
To measure success and provide value to paid users, the system will track:
- **Widget Impressions**: How many times a specific widget was loaded (e.g., how many people saw the OBS overlay).
- **Click-through Rate (CTR)**: How many people clicked a streamer's name in a widget to visit their channel.
- **Page Views**: Tracking visits to the public `/status/[groupId]` pages.
- **Conversion Tracking**: Monitoring the journey from "Widget Click" $\rightarrow$ "Landing Page" $\rightarrow$ "Sign Up".

## 6. Implementation Roadmap

### Phase 1: The Foundation
- Implement Twitch OAuth for user login.
- Set up the database for Users and Groups.
- Create a global Twitch status worker that caches data for all active groups.
- Build the User Dashboard for adding/removing friends.

### Phase 2: The Widget Engine
- Develop the dynamic routing system (`/widget/[groupId]`).
- Create the OBS-specific "Overlay Mode" (transparent, high-contrast).
- Generate unique embed codes for Twitch and Linktree.

### Phase 3: Monetization & Analytics
- Integrate Stripe for subscription management.
- Implement the "Washodo Members" requirement logic for free users.
- Build the analytics tracking pipeline for widget engagement.

### Phase 4: Growth & Branding
- Launch the `friends.washodo.tv` landing page.
- Implement the viral "Powered by" branding on free widgets.
