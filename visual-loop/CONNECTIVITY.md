# Visual Loop Connectivity Process

This document outlines the verified process for establishing a connection between the local application, the tunneling service, and the remote Browserless instance.

## 🛠 Architecture Flow
`Local App (Port 4000)` $\rightarrow$ `LocalTunnel (Public URL)` $\rightarrow$ `Browserless (Remote Chromium)` $\rightarrow$ `Playwright (Automation Script)`

## 🚀 Step-by-Step Setup

### 1. Start the Application
Ensure the API server is running on the expected port.
```bash
npm run dev
# Verify server is live on port 4000
curl -I http://localhost:4000
```

### 2. Establish the Public Tunnel
Use `localtunnel` to expose the local port to the internet.
```bash
npx localtunnel --port 4000
```
**Note:** Save the generated URL (e.g., `https://good-teams-follow.loca.lt`).

### 3. Configure Browserless & Environment
Ensure Browserless is running with `WORKSPACE_URL` set to its public ngrok address.
Verify `visual-loop/.env` contains:
- `BROWSERLESS_URL`: The public ngrok URL.
- `BROWSERLESS_TOKEN`: Your API token.

### 4. The Connection Handshake (Critical)
Because LocalTunnel presents a "friendly reminder" landing page to prevent phishing, automation scripts must bypass this before accessing the app.

**The Bypass Sequence:**
1. **Programmatic Header (Recommended)**: Add the header `bypass-tunnel-reminder: true` to all requests. This tells LocalTunnel to skip the "friendly reminder" landing page entirely.
2. **Manual Handshake**: If headers cannot be used, navigate the browser to:
   `https://localtunnel.me/tunnel-password?password=[PUBLIC_IP]`
3. **Access App**: Only after the bypass is active should the browser navigate to the LocalTunnel app URL.

**Playwright Connection Note:**
When connecting to Browserless via `connectOverCDP`, append the token to the URL (e.g., `https://.../?token=TOKEN`). This authorizes the mandatory `/json/version` discovery request.

## 🧪 Verification Command
To verify the entire chain is working without running a full audit, use the diagnostic script:
```bash
node visual-loop/verify-connection.js
```

## ⚠️ Troubleshooting
| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `ERR_NGROK_3200` | Browserless tunnel offline | Update `BROWSERLESS_URL` in `.env` |
| `net::ERR_CONNECTION_REFUSED` | App not running or wrong port | Check `npm run dev` and port 4000 |
| Stuck on LT Landing Page | Bypass cookie not set | Ensure the `tunnel-password` handshake is performed |
| 404 Not Found | Tunnel expired or wrong URL | Restart `localtunnel` and update the target URL |
