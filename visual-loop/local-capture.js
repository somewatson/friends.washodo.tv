const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const localtunnel = require('localtunnel');
require('dotenv').config();

async function getPublicIp() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (e) {
    console.error('❌ Failed to fetch public IP');
    return null;
  }
}

async function waitForApp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await axios.get(url);
      return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

(async () => {
  const PORT = 4000;
  const localUrl = `http://localhost:${PORT}`;
  
  const browserlessUrl = process.env.BROWSERLESS_URL;
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  
  if (!browserlessUrl || !browserlessToken) {
    console.error('❌ Missing BROWSERLESS_URL or BROWSERLESS_TOKEN in .env');
    process.exit(1);
  }

  const wsUrl = `${browserlessUrl.replace(/^https?:\/\//, 'wss://')}?token=${browserlessToken}`;
  const screenshotBaseDir = 'visual-loop/screenshots/local-test';
  
  console.log(`🚀 Starting Remote Visual Loop Orchestrator...`);
  
  console.log(`⏳ Checking if app is live at ${localUrl}...`);
  const isLive = await waitForApp(localUrl);
  if (!isLive) {
    console.error('❌ App not found on port 4000. Please ensure "npm run dev" is running.');
    process.exit(1);
  }
  console.log('✅ App is live!');

  let tunnel;
  try {
    console.log(`🌐 Establishing public tunnel for port ${PORT}...`);
    tunnel = await localtunnel({ port: PORT });
    console.log(`✅ Tunnel active: ${tunnel.url}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (err) {
    console.error(`❌ Failed to create tunnel: ${err.message}`);
    process.exit(1);
  }

  const targetUrl = tunnel.url;

  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'productivity', width: 1280, height: 1440 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  let browser;
  try {
    console.log(`🌐 Connecting to Browserless at ${browserlessUrl}...`);
    browser = await chromium.connectOverCDP(wsUrl);
    
    for (const vp of viewports) {
      console.log(`📸 Capturing [${vp.name}] (${vp.width}x${vp.height})...`);
      
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: 'WashodoWard-VisualLoop-Bot/1.0'
      });
      
      await context.setExtraHTTPHeaders({ 
        'Bypass-Tunnel-Reminder': 'true',
        'ngrok-skip-browser-warning': 'true'
      });
      
      const page = await context.newPage();

      try {
        const client = await page.context().newCDPSession(page);
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.name === 'mobile'
        });

        console.log(`🌐 Performing tunnel handshake for ${vp.name} at ${targetUrl}...`);
        const ip = await getPublicIp();
        if (ip) {
          await page.goto(`https://localtunnel.me/tunnel-password?password=${ip}`, { waitUntil: 'networkidle' });
        }

        console.log(`🔐 Authenticating at ${targetUrl}/warden-gate...`);
        // Use a more relaxed wait state for the login page to prevent hangs
        await page.goto(`${targetUrl}/warden-gate`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const contentCheck = await page.content();
        if (contentCheck.includes('friendly reminder') || contentCheck.includes('localtunnel.me')) {
          throw new Error('Stuck on LocalTunnel landing page despite handshake.');
        }

        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'password';
        
        await page.fill('input[name="username"]', username);
        await page.fill('input[name="password"]', password);
        
        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        ]);

        console.log(`🖱️ Navigating to System page...`);
        try {
          // Try UI click first (mimics user)
          await page.click('a[href*="system"]', { timeout: 5000, force: true });
          await page.waitForLoadState('domcontentloaded');
        } catch (clickErr) {
          console.log(`⚠️ UI click failed for ${vp.name}, falling back to direct navigation...`);
          await page.goto(`${targetUrl}/warden/system`, { waitUntil: 'domcontentloaded' });
        }

        const dir = path.join(screenshotBaseDir, vp.name);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const fileName = `system-${vp.name}.png`;
        await page.screenshot({ path: path.join(dir, fileName), fullPage: true });
        
        const htmlContent = await page.content();
        fs.writeFileSync(path.join(dir, `system-${vp.name}.html`), htmlContent);
        
        console.log(`✅ Saved ${vp.name} capture.`);
      } catch (err) {
        console.error(`❌ Error capturing ${vp.name}: ${err.message}`);
      } finally {
        await context.close();
      }
    }

  } catch (err) {
    console.error(`❌ Orchestrator failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (tunnel) {
      console.log('🔌 Closing tunnel...');
      await tunnel.close();
    }
  }
  
  console.log('🏁 Visual Loop Audit Complete.');
})();
