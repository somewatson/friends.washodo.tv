# Theme Engine Implementation Plan: Agency vs. Collective

## Objective
Implement a dynamic CSS theme engine that allows switching between the current "Agency" (Professional/Minimalist) aesthetic and a new "Collective" (Vibrant/Human) aesthetic without losing the original design.

## 🎨 Theme Definitions

### 1. Agency Theme (Current)
- **Vibe**: High-end venture studio, professional, clinical, dark.
- **Primary Accent**: Washodo Purple (`#a970ff`)
- **Secondary Accent**: Sky Blue (`#38bdf8`)
- **Tone**: Cool, deep, and authoritative.

### 2. Collective Theme (Proposed)
- **Vibe**: Festive unity ("Wasshoi"), high energy, human-centric, warm.
- **Primary Accent**: Unity Red (`#e63946`)
- **Secondary Accent**: Mastery Purple (`#a970ff`)
- **Tertiary Accent**: Harmony Blue (`#38bdf8`)
- **Highlight**: Golden Amber (`#facc15`)
- **Tone**: Warm, vibrant, and energetic.

## 🛠️ Technical Implementation

### CSS Architecture
- Move all color declarations from `:root` into theme-specific attribute selectors.
- Use `[data-theme="agency"]` as the default baseline.
- Use `[data-theme="collective"]` for the override set.
- Implement "Vibe Variables" (e.g., `--vibe-member`, `--vibe-friend`) to allow categories to change colors based on the active theme.

### UI Enhancements
- **Dynamic Glows**: Update `.guild-icon` borders and box-shadows to use the current theme's vibe variables.
- **Category Pills**: Refactor `.pill-member`, `.pill-friend`, etc., to use theme-driven colors.
- **Accent Integration**: Apply the new Unity Red to "Live" indicators and high-priority actions in the Collective theme.

### Switching Logic
- Implement a JavaScript utility to toggle the `data-theme` attribute on the `<html>` element.
- Add a temporary debug UI or console command for rapid testing between themes.

## 🚀 Roadmap
1. [ ] Refactor `public/admin.css` to the attribute-based variable system.
2. [ ] Define the "Collective" palette in CSS.
3. [ ] Update component styles to use the new dynamic variables.
4. [ ] Implement the theme-switching JS logic.
5. [ ] Verify with a Visual Audit (Desktop/Mobile).
