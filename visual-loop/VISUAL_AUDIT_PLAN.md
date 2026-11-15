# Visual Quality Audit Plan

## Objective
Ensure the Warden Admin Panel reaches a high standard of visual polish across all supported themes and viewports, specifically eliminating "uncanny valley" UI elements (like empty profile circles) and ensuring layout integrity at specific productivity resolutions.

## 📐 Viewport Matrix
The audit will cover the following resolutions:
- **Desktop**: 1920x1080 (Standard)
- **Productivity**: 1280x1440 (Half-1440p / Dual-browser setup)
- **Tablet**: 768x1024
- **Mobile**: 375x667

## 🎨 Thematic Baselines
- **Agency**: Professional, minimalist, clean.
- **Collective**: Vibrant, human, Unity Red (`#e63946`) accents and glows.

## 🔍 Audit Checklist
### 1. Profile Pictures & Avatars
- **The "Empty Circle" Fix**: Identify all instances where profile pictures are missing.
- **Requirement**: Replace blank/broken circles with polished placeholders (e.g., themed initials or brand icons) that match the active theme.

### 2. Layout & Responsiveness
- **Half-1440p (1280px)**: Verify that the layout doesn't feel cramped and that tables don't suffer from awkward wrapping or horizontal overflow.
- **Mobile/Tablet**: Ensure zero horizontal scrolling and that navigation elements are easily accessible.
- **Consistency**: Verify table column alignment and toggle positioning across all viewports.

### 3. UX & Visual Polish
- **Thematic Continuity**: Confirm "Collective" red is applied consistently to all interactive elements (buttons, active states, glows).
- **Information Hierarchy**: Ensure critical system explanations are provided as explicit text, avoiding hidden tooltips.
- **Interactive States**: Verify that destructive actions (Delete/Remove) have clear styling and confirmation dialogs.

## 🛠 Execution Workflow
1. **Viewport Update**: Add `1280x1440` to `visual-loop/audit-pages.js`.
2. **Capture Run**: Execute `node visual-loop/audit-pages.js --label quality-audit`.
3. **Inspection**: Manually review screenshots in `visual-loop/screenshots/latest/` focusing on the checklist above.
4. **Iterative Fixes**: Update CSS/JS to resolve identified visual bugs.
5. **Final Verification**: Re-run the audit to sign off on visual quality.
