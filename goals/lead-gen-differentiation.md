# Goal: Lead Generation Strategy & Community Differentiation

## Overview
This document outlines the strategy to differentiate two distinct conversion paths: 
1. **The SaaS Product (Lead Gen)**: Users who want to host their own "Friends Group" status page to promote their specific circle of streamers.
2. **The Community (Join Washodo)**: Individual streamers who want to be listed on the official Washodo Friends status page.

## 1. Branding & Visual Identity
### A. Homepage Overhaul
- **Logo**: Replace the text `<h1>Streamer Status</h1>` with the official Washodo logo image from the `public` folder.
- **Navigation**: 
    - Ensure all public pages (Home, Pricing, Streamer Detail) have a consistent header and footer.
    - Implement a "Home" navigation link (or clickable logo) to allow users to return to the root page from any sub-page.
- **Social Proof**: 
    - Implement a dynamic follower count calculation.
    - Display: *"Over [X] Twitch followers for this Washodo Friends group."* (where X is the sum of followers of all tracked streamers).

## 2. Conversion Path Differentiation

### Path A: Lead Generation (Hosting a Group Page)
**Value Proposition**: "Start your own hub to promote your friends."
- **Location**: The "Ready to get noticed?" pricing section.
- **Messaging Updates**:
    - Expand the description to emphasize the *ownership* of a page.
    - **New Copy**: *"Create your own community status page. Host a professional hub like this one to promote your group of streaming friends and grow together."*
- **Conversion Goal**: Drive users to the `/pricing` page to select a plan for their own instance.

### Path B: Community Integration (Joining Washodo)
**Value Proposition**: "Become a recognized part of the Washodo creator network."
- **Location**: A dedicated, simplified section replacing the old "Join" box.
- **Messaging Updates**:
    - Clarify that this is about joining the official brand.
    - **New Copy**: *"Want to join the Washodo creator group? Visit Washodo.tv to apply and be included in our official community list."*
- **Conversion Goal**: Direct external link to `Washodo.tv`.

## 3. Technical Implementation Plan

### Phase 0: Architectural Refactor (Best Practices)
- **Layout System**: Move away from string injection to a centralized rendering system.
- **Layout Template**: Create `public/layout.html` to house the global `<head>`, navigation, and footer.
- **View Renderer**: Implement `src/services/view.renderer.ts` to handle wrapping page content in the layout and injecting global variables.
- **HTML Separation**: Move inline HTML from `src/server.ts` into dedicated files in `public/pages/`.

### Phase 1: Backend Logic
- **Follower Aggregation**: Update the `/` route in `src/server.ts` to query the `followerCount` for all entities in `tracked_entities` and calculate the total.
- **Template Injection**: Pass this total count to the `ViewRenderer`.

### Phase 2: Frontend UI/UX
- **Logo & Nav**: Update `public/index.html` (and the new layout) to use the logo image and implement the global navigation header.
- **Content Rewrite**: 
    - Implement the expanded "Ready to get noticed?" copy.
    - Replace the "Join" box with the new "Join Washodo" community link.
    - Insert the dynamic follower count string.
- **Global Consistency**: Audit and update the streamer detail page and pricing page to ensure the header/footer are persistent via the `ViewRenderer`.

## 4. Success Criteria
- [ ] Logo is visible and replaces the text header.
- [ ] Header/Footer are present on all public pages.
- [ ] Dynamic follower count is calculated and displayed correctly on the home page.
- [ ] The "SaaS" value proposition is clearly distinct from the "Community" join link.
- [ ] The "Join Washodo" link directs users to Washodo.tv.
