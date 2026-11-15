# Visual Loop Operational Guide

This guide outlines the exact sequence of steps required to start the local environment and execute the visual feedback loop to provide the AI agent with "eyes" on the application.

## 🏗 Architecture Overview
The system consists of three primary components:
1.  **Main Application** (`port 3000`): The API and Frontend.
2.  **Discord Bot Runner** (`port 3001`): Decoupled process for Discord Gateway connections.
3.  **Visual Tunnel**: `localtunnel` (LT) exposing port 3000 to a public URL for the Browserless instance.

## ⚠️ Critical Constraints & Limits

### 1. Tunneling Limits (The "One-Tunnel" Rule)
- **Ngrok Limit**: The `NGROK_AUTHTOKEN` is currently used by a Dockerized Browserless instance. On the free plan, this consumes the only available tunnel slot.
- **Solution**: Use `localtunnel` (LT) for the application tunnel. Do **not** attempt to start a second ngrok tunnel, as it will result in `ERR_NGROK_334`.

### 2. LocalTunnel Security (The Landing Page)
- **The Block**: LT presents a "friendly reminder" landing page to prevent phishing. This page blocks automation (Playwright) because it doesn't contain the app's HTML.
- **The Bypass**: The script must fetch the host's public IP via `api.ipify.org` and navigate to `https://localtunnel.me/tunnel-password?password=[IP]` to set the required bypass cookie before navigating to the app.

### 3. Browserless Connection
- **CDP Connection**: The agent connects to Browserless via WebSockets using a token.
- **Viewport**: Set to `1920x1080` to ensure desktop layout consistency and avoid mobile-stacking in screenshots.
- **Headers**: Use `ngrok-skip-browser-warning: true` (for ngrok) and `Bypass-Tunnel-Reminder: true` (for LocalTunnel) to avoid interstitial landing pages.
- **User-Agent**: Use a non-standard User-Agent (e.g., `WashodoWard-VisualLoop-Bot/1.0`) to further ensure bypass of "friendly reminder" pages.

## 🚀 Startup Sequence

### Step 1: Launch the Full Stack
```bash
npm run dev
```
*Ensure both the API Server (3000) and Bot Runner (3001) are live.*

### Step 2: Execute the Visual Audit
The `audit-pages.js` script handles the tunnel lifecycle:
```bash
node visual-loop/audit-pages.js
```

## 📚 Lessons Learned & Debugging
...
### "Incorrect Route Capture" (The Handshake Failure)
- **Cause**: The browser is redirected (e.g., to the default Streamers page) or fails to navigate, but the generic `data-loaded="true"` signal still fires.
- **Fix**: The server now injects a `data-route` attribute. The audit script verifies that the `data-route` matches the expected route name. If they mismatch, it's a navigation/auth failure, not a rendering failure.

### "Bad Gateway" (502)
- **Cause**: LocalTunnel servers are occasionally unstable or the local process on port 3000 has crashed/restarted.
- **Fix**: Restart the `npm run dev` process and try the audit again.

### "Timeout waiting for selector"
- **Cause**: The browser is stuck on the LT landing page or a "Bad Gateway" page.
- **Fix**: Check `visual-loop/screenshots/debug-gate-content.html` to see the raw HTML the browser is receiving.

### "Port 3000 already in use"
- **Cause**: Orphaned node processes from previous crashes.
- **Fix**: Run `pkill -f node` or `pkill -f nodemon` before restarting.

## 🔄 The Feedback Cycle
1. **Audit**: Run `audit-pages.js`.
2. **Review**: Examine `.png` and `.html` files in `/visual-loop/screenshots/`.
3. **Fix**: Modify source code in `src/` or `public/`.
4. **Verify**: Re-run audit and compare screenshots.
