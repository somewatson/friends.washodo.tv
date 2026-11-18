# Visual Loop Operational Guide
 
This guide outlines the exact sequence of steps required to execute the visual feedback loop, providing the AI agent with "eyes" on the application across multiple viewports and themes.
 
## 🏗 Architecture Overview
 
The system follows a "Black Box" auditing pattern:
1.  **Main Application** (`port 4000`): The API and Frontend (must be running independently).
2.  **Discord Bot Runner** (`port 3001`): Decoupled process for Discord Gateway connections.
3.  **Visual Orchestrator** (`local-capture.js`): An autonomous script that manages the tunnel, browser session, and audit sequence.
4.  **Public Tunnel** (`cloudflared`): Exposes the local app to a dynamic public URL via Cloudflare Quick Tunnels.
5.  **Remote Browser** (`Browserless`): A headless Chromium instance that connects to the public tunnel to capture screenshots.
 
### 🛠 The Autonomous Flow
The `local-capture.js` script automates the following sequence:
`Local Health Check` $\rightarrow$ `Dynamic Tunnel Creation (Cloudflare)` $\rightarrow$ `Browserless Connection` $\rightarrow$ `Admin Auth` $\rightarrow$ `Adaptive Navigation` $\rightarrow$ `Viewport Captures`.
 
## ⚠️ Critical Constraints & Limits
 
### 1. Tunneling & Networking
- **Dynamic URLs**: The system uses Cloudflare Quick Tunnels to create random public URLs (`*.trycloudflare.com`). This prevents "Wrong Door" errors caused by stale static URLs in `.env`.
- **Stability**: Cloudflare Tunnels are used instead of LocalTunnel to avoid landing-page bypass requirements and provide higher uptime.
- **Remote Access**: Browserless cannot access `localhost`. All navigation is performed via the dynamically generated public tunnel URL.
- **Mode Selection**: Use `TUNNEL_MODE` in `.env`:
    - `AUTO`: Use `TUNNEL_URL` if set, else spin up a new Cloudflare tunnel.
    - `MANUAL`: Force use of `TUNNEL_URL`.
    - `SPINUP`: Always create a new programmatic tunnel.
 
### 2. Viewport & Rendering
- **CDP Overrides**: Standard Playwright `viewport` settings are often ignored by remote Browserless instances. The orchestrator uses `Emulation.setDeviceMetricsOverride` via a CDP session to force the actual browser window size.
- **Adaptive Navigation**: On Tablet and Mobile viewports, the application uses a hamburger menu. The orchestrator detects the viewport type and clicks the `.collapse-btn` before attempting to navigate to specific admin pages.
- **Render-Check**: Because the admin panel renders content asynchronously via API, the orchestrator waits for a `waitSelector` (e.g., `.streamer-card`) to appear before taking the screenshot to prevent "blank page" captures.
 
## 🚀 Execution Guide
 
### Step 1: Launch the Application
The server must be running in a separate terminal before starting the audit.
```bash
npm run dev
```
 
### Step 2: Execute the Visual Audit
Run the autonomous orchestrator:
```bash
npm run dev:visual
```
 
### Step 3: (Optional) Persistent Tunnel
To maintain a stable URL across multiple manual tests:
```bash
npm run tunnel
```
 
## 🔍 The Audit Pipeline
 
### 1. Full Suite Audit
The orchestrator uses a **Route Manifest** to iterate through all admin routes $\times$ all viewports, generating a comprehensive visual baseline.
- **Desktop**: 1920x1080
- **Productivity**: 1280x1440
- **Tablet**: 768x1024
- **Mobile**: 375x667
 
### 2. Review Process
Screenshots and raw HTML are stored in `visual-loop/screenshots/audit-[timestamp]/[route]/[viewport]/`.
- **Visual Audit**: Check for layout breaks, overlapping elements, or poor contrast.
- **Responsive Audit**: Ensure tables don't cause horizontal overflow on mobile and that click targets are appropriately sized.
 
## 📚 Troubleshooting
 
### "Target page, context or browser has been closed"
- **Cause**: Remote session timeout or a crash during a long `networkidle` wait.
- **Fix**: The script implements a **Session Recovery** loop; if the browser connection is lost, it automatically reconnects and resumes from the current route/viewport.
 
### "UI Click Failed"
- **Cause**: Element obscured by a mobile menu or shifted by responsive CSS.
- **Fix**: The orchestrator uses `force: true` for clicks and falls back to direct `page.goto()` if the UI path is blocked.
 
### Browserless Connection Failure
- **Cause**: Browserless instance offline or token expired.
- **Fix**: Verify `BROWSERLESS_URL` and `BROWSERLESS_TOKEN` in the root `.env` file.