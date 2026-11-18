const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Tunnel } = require('cloudflared');
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

async function checkTunnelHealth(url) {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    return response.status === 200 || response.status === 401 || response.status === 404;
  } catch (e) {
    console.error(`❌ Tunnel Health Check Failed: ${url} is unreachable.`);
    return false;
  }
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
  const screenshotBaseDir = `visual-loop/screenshots/audit-${timestamp}`;
  
  console.log(`🚀 Starting RESILIENT Visual Audit with Cloudflare...`);
  
  if (!(await waitForApp(localUrl))) {
    console.error('❌ App not found on port 4000. Please run \"npm run dev\".');
    process.exit(1);
  }

  let tunnel = null;
  let targetUrl = null;

  if (TUNNEL_MODE === 'MANUAL' || (TUNNEL_MODE === 'AUTO' && suppliedTunnelUrl)) {
    if (!suppliedTunnelUrl) {
      console.error('❌ TUNNEL_MODE is MANUAL but no TUNNEL_URL provided in .env');
      process.exit(1);
    }
    targetUrl = suppliedTunnelUrl.replace(/\/$/, '');
    
    console.log(`🌐 Checking health of provided TUNNEL_URL: ${targetUrl}...`);
    if (!(await checkTunnelHealth(targetUrl))) {
      console.error('❌ Provided tunnel is down. Please run \"npm run tunnel\" or check your URL.');
      process.exit(1);
    }
    console.log(`✅ Tunnel is healthy.`);
  } else {
    console.log(`🌐 Spinning up a programmatic Cloudflare tunnel on port ${PORT}...`);
    try {
      tunnel = Tunnel.quick(`http://localhost:${PORT}`);
      targetUrl = await new Promise((resolve) => tunnel.once('url', resolve));
      targetUrl = targetUrl.replace(/\/$/, '');
      console.log(`✅ Cloudflare Tunnel active: ${targetUrl}`);
      
      await new Promise((resolve) => tunnel.once('connected', resolve));
      console.log(`✅ Tunnel connection established.`);
    } catch (err) {
      console.error(`❌ Failed to create tunnel: ${err.message}`);
      process.exit(1);
    }
  }

  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'productivity', width: 1280, height: 1440 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  const routes = [
    { path: '/warden/streamers', name: 'streamers', waitSelector: '.streamer-card, #streamers-table' },
    { path: '/warden/discord', name: 'discord', waitSelector: '.card' },
    { path: '/warden/discord-logs', name: 'discord-logs', waitSelector: '.interaction-card, #discord-logs-container' },
    { path: '/warden/mattermost', name: 'mattermost', waitSelector: '.card' },
    { path: '/warden/broadcasts', name: 'broadcasts', waitSelector: '.card' },
    { path: '/warden/system', name: 'system', waitSelector: '.card' },
  ];

  // Check for target route in command line arguments
  const targetRouteArg = process.argv[2];
  let routesToAudit = routes;

  if (targetRouteArg) {
    routesToAudit = routes.filter(r => r.name === targetRouteArg);
    if (routesToAudit.length === 0) {
      console.error(`❌ Target route "${targetRouteArg}" not found in configuration.`);
      console.log(`Available routes: ${routes.map(r => r.name).join(', ')}`);
      process.exit(1);
    }
    console.log(`🎯 Targeted Audit: Only auditing ${targetRouteArg}`);
  }

  let browser = null;

  async function ensureBrowser() {
    if (!browser) {
      console.log('🌐 Connecting to Browserless...');
      browser = await createBrowser(browserlessUrl, browserlessToken);
    }
    return browser;
  }

  try {
    for (const route of routesToAudit) {
      console.log(`\\n🗺️ Auditing Route: ${route.path}`);
      
      for (const vp of viewports) {
        console.log(`📸 Capturing [${vp.name}] (${vp.width}x${vp.height})...`);
        
        let success = false;
        let retries = 0;
        const maxRetries = 3;

        while (!success && retries < maxRetries) {
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
              'Pragma': 'no-cache',
              'Expires': '0'
            });
            
            page = await context.newPage();

            const client = await page.context().newCDPSession(page);
            await client.send('Network.setCacheDisabled', { cacheDisabled: true });
            await client.send('Emulation.setDeviceMetricsOverride', {
              width: vp.width,
              height: vp.height,
              deviceScaleFactor: 1,
              mobile: vp.name === 'mobile'
            });

            const ip = await getPublicIp();
            if (ip && targetUrl.includes('localtunnel.me')) {
              await page.goto(`https://localtunnel.me/tunnel-password?password=${ip}`, { waitUntil: 'networkidle' });
            }

            await page.goto(`${targetUrl}/warden-gate`, { waitUntil: 'domcontentloaded' });
            await page.fill('input[name=\"username\"]', process.env.ADMIN_USERNAME || 'admin');
            await page.fill('input[name=\"password\"]', process.env.ADMIN_PASSWORD || 'password');
            await Promise.all([
              page.click('button[type=\"submit\"]'),
              page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            ]);

            try {
              if (vp.name === 'tablet' || vp.name === 'mobile') {
                const menuBtn = page.locator('.collapse-btn');
                if (await menuBtn.isVisible()) {
                  await menuBtn.click();
                  await page.waitForTimeout(500);
                }
              }
              const navLink = page.locator(`a[href*=\"${route.path}\"]`);
              await navLink.click({ timeout: 5000, force: true });
              await page.waitForLoadState('domcontentloaded');
            } catch (clickErr) {
              await page.goto(`${targetUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
            }

            try {
              await page.waitForSelector(route.waitSelector, { timeout: 10000 });
              await page.waitForTimeout(1000);
            } catch (waitErr) {
              console.log(`⚠️ Selector ${route.waitSelector} not found within 10s for ${route.name} [${vp.name}]`);
            }

            const dir = path.join(screenshotBaseDir, route.name, vp.name);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const fileName = `${route.name}-${vp.name}.png`;
            const htmlName = `${route.name}-${vp.name}.html`;
            const filePath = path.join(dir, fileName);
            const htmlPath = path.join(dir, htmlName);

            await page.screenshot({ path: filePath, fullPage: true });
            fs.writeFileSync(htmlPath, await page.content());
            
            // Mirror to latest folder
            const latestDir = path.join('visual-loop/screenshots/latest', route.name, vp.name);
            if (!fs.existsSync(latestDir)) fs.mkdirSync(latestDir, { recursive: true });
            fs.copyFileSync(filePath, path.join(latestDir, fileName));
            fs.copyFileSync(htmlPath, path.join(latestDir, htmlName));

            console.log(`✅ Saved ${route.name} [${vp.name}].`);
            success = true;
          } catch (err) {
            retries++;
            console.error(`❌ Error capturing ${route.name} [${vp.name}] (Attempt ${retries}/${maxRetries}): ${err.message}`);
            if (err.message.includes('closed') || err.message.includes('Target closed')) {
              console.log('♻️ Browser session lost. Resetting browser connection for retry...');
              browser = null; 
            }
            if (retries === maxRetries) {
              console.error(`🛑 Failed to capture ${route.name} [${vp.name}] after ${maxRetries} attempts.`);
            }
          } finally {
            if (context) await context.close();
          }
        }
      }
    }

  } catch (err) {
    console.error(`❌ Orchestrator fatal error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
    if (tunnel) tunnel.stop();
  }
  console.log('🏁 Full Route Visual Audit Complete.');
})();
