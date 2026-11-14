const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
require('dotenv').config({ path: 'visual-loop/.env' });
const fs = require('fs');
const path = require('path');

async function setupTunnel() {
  const token = process.env.NGROK_AUTHTOKEN;
  if (!token) throw new Error('NGROK_AUTHTOKEN not found in .env');

  console.log('Configuring ngrok auth token...');
  try {
    execSync('./bin/ngrok config add-authtoken ' + token);
  } catch (e) {
    console.log('Auth token might already be set or failed: ' + e.message);
  }

  const appPort = process.env.APP_PORT || '3001';

  console.log(`Starting ngrok tunnel for localhost:${appPort}...`);
  
  // Kill existing ngrok processes to avoid token/port conflicts
  try {
    execSync('pkill ngrok || true');
  } catch (e) {}

  const ngrokProcess = spawn('./bin/ngrok', ['http', appPort], {
    detached: true,
    stdio: 'ignore'
  });
  ngrokProcess.unref();
  
  // INCREASED WAIT: Give ngrok more time to start and bind the API port (4040)
  console.log('Waiting 12 seconds for ngrok API to become available...');
  await new Promise(resolve => setTimeout(resolve, 12000));

  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://127.0.0.1:4040/api/tunnels');
      if (response.ok) {
        const data = await response.json();
        if (data.tunnels && data.tunnels.length > 0) {
          const publicUrl = data.tunnels[0].public_url;
          console.log(`🚀 App tunnel established: ${publicUrl}`);
          return publicUrl;
        }
      }
    } catch (error) {
      console.log(`Attempt ${attempts + 1}: Ngrok API not ready yet...`);
    }
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  throw new Error('Failed to retrieve public URL from ngrok API after multiple attempts.');
}

async function auditApp(appUrl) {
  const rawUrl = process.env.BROWSERLESS_URL || '';
  const baseBrowserlessUrl = rawUrl.replace(/^https?:\/\//, 'wss://');
  const token = process.env.BROWSERLESS_TOKEN;
  const wsUrl = `${baseBrowserlessUrl}?token=${token}`;
  const screenshotDir = process.env.SCREENSHOT_DIR || 'visual-loop/screenshots';

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log(`Connecting to Browserless: ${wsUrl}`);
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(wsUrl);
    console.log('✅ Successfully connected to Browserless!');
    
    const context = browser.contexts().length > 0 
      ? browser.contexts()[0] 
      : await browser.newContext();

    await context.setExtraHTTPHeaders({
      'ngrok-skip-browser-warning': 'true'
    });
    
    const page = await context.newPage();
    
    // LOGIN PHASE
    console.log('Logging into Warden...');
    await page.goto(`${appUrl}/warden-gate`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.fill('input[name="username"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'password');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle' }),
    ]);
    console.log('✅ Logged in successfully!');

    const routes = [
      { name: 'home', path: appUrl },
      { name: 'warden-gate', path: `${appUrl}/warden-gate` },
      { name: 'warden-dashboard', path: `${appUrl}/warden-access` },
      { name: 'warden-broadcasts', path: `${appUrl}/warden/broadcasts` },
      { name: 'warden-streamers', path: `${appUrl}/warden/streamers` },
      { name: 'warden-integrations', path: `${appUrl}/warden/integrations` },
      { name: 'warden-leads', path: `${appUrl}/warden-access?page=leads` },
      { name: 'warden-webhooks', path: `${appUrl}/warden-access?page=webhooks` },
      { name: 'warden-system', path: `${appUrl}/warden-access?page=system` },
    ];

    for (const route of routes) {
      console.log(`Auditing ${route.name}: ${route.path}`);
      try {
        await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for the "ready signal" from the frontend
        console.log(`Waiting for ${route.name} to signal readiness...`);
        await page.waitForSelector('body[data-loaded="true"]', { timeout: 30000 });
        
        const screenshotPath = path.join(screenshotDir, `${route.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        const htmlPath = path.join(screenshotDir, `${route.name}.html`);
        const content = await page.content();
        fs.writeFileSync(htmlPath, content);

        console.log(`✅ Saved ${route.name} assets`);
      } catch (routeError) {
        console.error(`❌ Failed to audit ${route.name}: ${routeError.message}`);
      }
    }

    await browser.close();
  } catch (error) {
    console.error('Audit failed:');
    console.error(error);
    if (browser) await browser.close();
    throw error;
  }
}

(async () => {
  try {
    const appUrl = await setupTunnel();
    await auditApp(appUrl);
    console.log('Audit complete.');
    process.exit(0);
  } catch (error) {
    console.error('Critical Audit Error:');
    console.error(error);
    process.exit(1);
  }
})();
