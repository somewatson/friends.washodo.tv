const { chromium } = require('playwright');
const axios = require('axios');
require('dotenv').config();

(async () => {
  const PUBLIC_URL = 'https://good-teams-follow.loca.lt';
  const BROWSERLESS_URL = process.env.BROWSERLESS_URL || '';
  const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '';
  
  if (!BROWSERLESS_URL || !BROWSERLESS_TOKEN) {
    console.error('❌ Missing BROWSERLESS_URL or BROWSERLESS_TOKEN in .env');
    process.exit(1);
  }

  const wsUrl = `${BROWSERLESS_URL.replace(/^https?:\/\//, 'wss://')}?token=${BROWSERLESS_TOKEN}`;
  
  let browser;
  try {
    console.log(`🌐 Connecting to Browserless at: ${BROWSERLESS_URL}...`);
    browser = await chromium.connectOverCDP(wsUrl);
    const context = await browser.newContext({
      userAgent: 'WashodoWard-Connection-Test/1.0'
    });
    const page = await context.newPage();

    // 1. Get Public IP for LT Bypass
    console.log(`🌐 Fetching public IP for LocalTunnel bypass...`);
    const ipResponse = await axios.get('https://api.ipify.org');
    const publicIp = ipResponse.data;
    console.log(`✅ Public IP: ${publicIp}`);

    // 2. Perform LT Bypass Handshake
    const bypassUrl = `https://localtunnel.me/tunnel-password?password=${publicIp}`;
    console.log(`🌐 Navigating to bypass: ${bypassUrl}...`);
    await page.goto(bypassUrl, { waitUntil: 'networkidle' });
    console.log(`✅ Bypass cookie set.`);

    // 3. Try to access the app
    console.log(`🌐 Navigating to app: ${PUBLIC_URL}...`);
    const response = await page.goto(PUBLIC_URL, { waitUntil: 'networkidle' });
    
    if (response.status() >= 400) {
      throw new Error(`App returned status ${response.status()}`);
    }

    // 4. Verify app content
    const title = await page.title();
    const bodyText = await page.innerText('body');
    
    if (bodyText.includes('Washodo') || bodyText.includes('Login') || title.includes('Washodo')) {
      console.log(`✅ SUCCESS: Successfully connected to the web app through the tunnel!`);
      console.log(`Page Title: ${title}`);
    } else {
      console.error(`❌ FAILURE: Reached a page, but it doesn't look like the app.`);
      console.log(`Page Title: ${title}`);
    }

  } catch (err) {
    console.error(`❌ CONNECTION ERROR: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
