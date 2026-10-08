# Analytics and Favicon Integration Plan

## 1. Umami Analytics Integration
**Objective:** Integrate Umami analytics to track website traffic.

### Tasks:
- [ ] **Locate Base HTML:** Find the main HTML template or head section (e.g., `index.html`, `layout.tsx`, or equivalent).
- [ ] **Inject Script:** Add the following script to the `<head>` section:
```html
<script defer src="https://beancounter.somewatson.com/script.js" data-website-id="cf5643bb-9645-4789-b5fd-a03e9944cf75"></script>
```
- [ ] **Verify Integration:** Ensure the script loads correctly in the browser and data is sent to the Umami dashboard.
- [ ] **Event Tracking (Optional):** Reference [Umami Docs](https://docs.umami.is/docs/track-events) to implement `umami.track()` for specific user interactions.

## 2. Favicon Implementation
**Objective:** Set the website favicon to match washodo.tv.

### Tasks:
- [ ] **Retrieve Favicon:** Download the favicon from `https://washodo.tv/favicon.ico`.
- [ ] **Save Asset:** Place the file in the project's public assets directory (e.g., `/public/favicon.ico`).
- [ ] **Update HTML:** Add the following link tag to the `<head>` section:
```html
<link rel="icon" href="/favicon.ico" type="image/x-icon">
```
