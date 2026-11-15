# Visual Loop Roadmap: From Capture to Polish

This document outlines the evolution of the visual feedback loop from a basic capture tool to a comprehensive UI/UX quality assurance system.

## Phase 1: Stable Capture (Completed ✅)
*Goal: Establish a reliable way to "see" the application at 1080p.*
- [x] 1080p Viewport stabilization.
- [x] Route Handshake (`data-route`) to verify correct page rendering.
- [x] Dynamic Route Discovery via Server API.
- [x] Session-based organized storage with rolling retention.
- [x] "Smoke" vs "Full" capture modes.

## Phase 2: UI/UX Polish Sprint (Active 🚀)
*Goal: Use the visual loop to iteratively refine the aesthetic and usability of the application.*
- [ ] **Visual Consistency Audit**: Ensure unified padding, margins, and color palettes across all Warden routes.
- [ ] **Responsive Verification**: Expand the loop to capture mobile and tablet viewports.
- [ ] **Empty State Design**: Implement and verify polished "No Data" states across all tables.
- [ ] **Interactive Element Polish**: Refine hover states, transitions, and button consistency.

## Phase 3: Automated Regression (Planned 📅)
*Goal: Prevent visual regressions using automated comparison.*
- [ ] **Pixel-Diffing**: Implement a script to compare the `latest` session against a `baseline` session.
- [ ] **Diff Mapping**: Generate heatmaps showing exactly where layout shifts occurred.
- [ ] **Stability Scoring**: Calculate a percentage match score for each route.

## Phase 4: CI/CD Integration (Planned 📅)
*Goal: Make visual verification a requirement for deployment.*
- [ ] **Visual Gate**: Add `npm run visual-verify` to the build pipeline.
- [ ] **Automatic Failure**: Fail the build if a route mismatch occurs or a critical UI element is missing.
- [ ] **Golden Image Gallery**: Maintain a gallery of "Perfect" states for reference.
