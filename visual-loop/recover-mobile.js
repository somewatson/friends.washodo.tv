const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Tunnel } = require('cloudflared');
require('dotenv').config();

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

async function createBrowser(browserlessUrl, token) {
  const finalWsUrl = browserlessUrl.replace('http://', 'wss://').replace('https://', 'wss://') + `?token=${token}`;
  return await chromium.connectOverCDP(finalWsUrl);
}

(async () => {
  const PORT = 4000;
  const localUrl = `http://localhost:${PORT}`;
  const browserlessUrl = process.env.BROWSERLESS_URL;
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  
  const TUNNEL_MODE = process.env.TUNNEL_MODE || 'AUTO'; 
  const suppliedTunnelUrl = process.env.TUNNEL_URL;

  if (!browserlessUrl || !browserlessToken) {
    console.error('❌ Missing BROWSERLESS_URL or BROWSERLESS_TOKEN in .env');
    process.exit(1);
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/T/, '_').replace(/\\..+Z$/, '').replace(/:/g, '-');
  const screenshotBaseDir = `visual-loop/screenshots/recovery-${timestamp}`;
  
  console.log(`🚀 Starting STABLE Targeted Recovery Audit...`);
  
  if (!(await waitForApp(localUrl))) {
    console.error('❌ App not found on port 4000.');
    process.exit(1);
  }

  let tunnel = null;
  let targetUrl = null;

  if (TUNNEL_MODE === 'MANUAL' || (TUNNEL_MODE === 'AUTO' && suppliedTunnelUrl)) {
    targetUrl = suppliedTunnelUrl.replace(/\/$/, '');
  } else {
    try {
      tunnel = Tunnel.quick(`http://localhost:${PORT}`);
      targetUrl = await new Promise((resolve) => tunnel.once('url', resolve));
      targetUrl = targetUrl.replace(/\/$/, '');
      await new Promise((resolve) => tunnel.once('connected', resolve));
    } catch (err) {
      console.error(`❌ Tunnel error: ${err.message}`);
      process.exit(1);
    }
  }

  const vp = { name: 'mobile', width: 375, height: 667 };
  const routes = [
    { path: '/warden/streamers', name: 'streamers', waitSelector: '.streamer-card, #streamers-table' },
    { path: '/warden/discord-logs', name: 'discord-logs', waitSelector: '.interaction-card, #discord-logs-container' },
    { path: '/warden/broadcasts', name: 'broadcasts', waitSelector: '.card' },
  ];

  let browser = null;

  async function ensureBrowser() {
    if (!browser) {
      browser = await createBrowser(browserlessUrl, browserlessToken);
    }
    return browser;
  }

  try {
    for (const route of routes) {
      console.log(`📸 Recovering ${route.name} [mobile]...`);
      
      let context = null;
      let page = null;

      try {
        const b = await ensureBrowser();
        context = await b.newContext({
          viewport: { width: vp.width, height: vp.height },
          userAgent: 'WashodoWard-VisualLoop-Bot/1.0'
        });
        
        await context.setExtraHTTPHeaders({ 
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true',
          'Cache-Control': 'no-cache',
        });
        
        page = await context.newPage();
        const client = await page.context().newCDPSession(page);
        await client.send('Network.setCacheDisabled', { cacheDisabled: true });
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: true
        });

        // Use a clean sequence: Login -> Navigate -> Screenshot
        await page.goto(`${targetUrl}/warden-gate`, { waitUntil: 'networkidle' });
        await page.fill('input[name=\"username\"]', process.env.ADMIN_USERNAME || 'admin');
        await page.fill('input[name=\"password\"]', process.env.ADMIN_PASSWORD || 'password');
        
        await Promise.all([
          page.click('button[type=\"submit\"]'),
          page.waitForNavigation({ waitUntil: 'networkidle' }),
        ]);

        // Navigate directly to avoid interaction issues during recovery
        await page.goto(`${targetUrl}${route.path}`, { waitUntil: 'networkidle' });
        
        try {
          await page.waitForSelector(route.waitSelector, { timeout: 15000 });
          await page.waitForTimeout(1000);
        } catch (e) {
          console.log(`⚠️ Timeout waiting for ${route.waitSelector} on ${route.name}`);
        }

        const dir = path.join(screenshotBaseDir, route.name, vp.name);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        await page.screenshot({ path: path.join(dir, `${route.name}-${vp.name}.png`), fullPage: true });
        console.log(`✅ Recovered ${route.name} [mobile].`);
      } catch (err) {
        console.error(`❌ Failed to recover ${route.name}: ${err.message}`);
        browser = null; 
      } finally {
        if (context) await context.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    if (tunnel) tunnel.stop();
  }
})();
