# Frontend Improvement & Bug Fix Plan

This document outlines the strategy for using the Visual Feedback Loop to improve the Washodo Ward frontend.

## 🎯 Objectives
- Eliminate layout shifting in the Warden Admin panel.
- Ensure strict adherence to the `washodo_style_guide.md` (Colors: `#a970ff`, `#38bdf8`).
- Replace all `alert()` and `prompt()` calls with stylized in-page notifications.
- Verify "Dual-Context Visibility" for timezones in the admin interface.
- Ensure all destructive actions have a confirmation dialog.

## 🛠 Execution Workflow (The Loop)
For every identified issue, the agent will follow this cycle:
1. **Discovery**: Use `audit-pages.js` or manual Playwright navigation to find a bug.
2. **Capture**: Take a screenshot of the bug and extract the relevant DOM/CSS.
3. **Implement**: Modify the TypeScript/HTML/CSS source code in `src/` or `public/`.
4. **Verify**: Use `verify-fix.js` to confirm the UI now looks and behaves correctly.

## 📅 Implementation Phases

### Phase 1: Connectivity (Current)
- [x] Install `ngrok` and `playwright`.
- [x] Establish connection between Browserless and the local app tunnel.
- [ ] Verify navigation to key routes (`/`, `/warden-gate`, `/warden`).

### Phase 2: Audit & Baseline
- [ ] Create `audit-pages.js` to capture screenshots of all main views.
- [ ] Compare existing UI against `washodo_style_guide.md`.
- [ ] Log all CSS/JS errors from the browser console.

### Phase 3: Targeted Fixes
- [ ] Fix Admin Table layouts (prevent horizontal scrolling).
- [ ] Implement toast/banner notifications for API feedback.
- [ ] Standardize button styles and interaction states.

### Phase 4: UX Polish
- [ ] Refine timezone displays in the Admin UI.
- [ ] Audit responsive behavior across different viewport sizes.
- [ ] Final visual sign-off of all critical user flows.
