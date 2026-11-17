const axios = require('axios');
const { chromium } = require('playwright');
require('dotenv').config({ path: 'visual-loop/.env' });
const { execSync } = require('child_process');

async function verifyStack() {
    console.log('--- 🛠️ Visual Loop Stack Health Check ---');
    let allGreen = true;

    // 1. Check Local App Server (Port 4000)
    try {
        await axios.get('http://localhost:4000');
        console.log('✅ App Server: Online (localhost:4000)');
    } catch (e) {
        console.error('❌ App Server: Offline! Please run "npm run dev".');
        allGreen = false;
    }

    // 2. Check LocalTunnel Process
    try {
        execSync('ps aux | grep localtunnel | grep -v grep');
        console.log('✅ LocalTunnel Process: Running');
    } catch (e) {
        console.error('❌ LocalTunnel Process: Not found. Please start localtunnel --port 4000');
        allGreen = false;
    }

    // 3. Check Browserless HTTP (Token check)
    const BROWSERLESS_URL = process.env.BROWSERLESS_URL || '';
    const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '';
    try {
        const resp = await axios.get(`${BROWSERLESS_URL}/pressure?token=${BROWSERLESS_TOKEN}`);
        console.log(`✅ Browserless HTTP: Online (Status ${resp.status})`);
    } catch (e) {
        console.error(`❌ Browserless HTTP: Offline/Unauthorized (${e.message})`);
        allGreen = false;
    }

    // 4. Check Browserless WebSocket (The "0.0.0.0" test)
    try {
        const wsUrl = BROWSERLESS_URL.replace(/^https?:\/\//, 'wss://') + 
                      (BROWSERLESS_URL.includes('?') ? '&' : '?') + 
                      `token=${BROWSERLESS_TOKEN}`;
        const browser = await chromium.connectOverCDP(wsUrl);
        console.log('✅ Browserless WebSocket: Connected (Discovery worked!)');
        await browser.close();
    } catch (e) {
        console.error(`❌ Browserless WebSocket: Connection Failed (${e.message})`);
        if (e.message.includes('0.0.0.0')) {
            console.error('👉 CRITICAL: Browserless is returning internal IP. Check EXTERNAL env var in docker-compose.');
        }
        allGreen = false;
    }

    return allGreen;
}

(async () => {
    const result = await verifyStack();
    if (!result) {
        console.log('\n❌ Stack is NOT healthy. Please fix the errors above.');
        process.exit(1);
    }
    console.log('\n✅ Stack is HEALTHY. Ready for capture.');
    process.exit(0);
})();
