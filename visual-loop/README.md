# Visual Feedback Loop

This folder contains the automation tools used to provide the AI agent with "eyes" on the application. By connecting a remote Browserless instance to a local tunnel of the app, the agent can interact with the frontend, take screenshots, and verify fixes in real-time.

## 🛠 How it Works
1. **Tunnelling**: An `ngrok` tunnel is established from the local application (port 3000) to a public URL.
2. **Remote Browser**: The agent connects to a `Browserless` instance via WebSockets.
3. **Interaction**: The Browserless instance navigates to the ngrok URL, allowing the agent to execute Playwright scripts to audit the UI and test functionality.
4. **Verification**: After making code changes in the main project, the agent runs a verification script to visually confirm the fix.

## 📁 Folder Structure
- `bin/`: Contains the `ngrok` binary.
- `.env`: Configuration for tokens and URLs.
- `connect-test.js`: Connectivity diagnostic script.
- `audit-pages.js`: (Planned) Script to scan all pages for UI bugs.
- `verify-fix.js`: (Planned) Targeted script for verifying specific changes.
- `screenshots/`: Directory where visual audits are saved.

## 🚀 Getting Started
Ensure your `.env` is configured with:
- `NGROK_AUTHTOKEN`
- `BROWSERLESS_TOKEN`
- `BROWSERLESS_URL`
