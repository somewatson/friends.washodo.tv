const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: 'visual-loop/.env' });

const CONFIG = {
  PORT: 3000,
  VIEWPORT: { width: 1920, height: 1080 },
  USER_AGENT: 'WashodoWard-VisualLoop-Bot/1.0',
  HEADERS: {
    'Bypass-Tunnel-Reminder': 'true',
  },
  TIMEOUTS: {
    TUNNEL: 20000,
    NAVIGATION: 60000,
    SELECTOR: 30000,
    LOGIN_FIELD: 15000
  },
  MAX_SESSIONS: 10,
  CORE_ROUTES: [
    { name: 'home', path: '/' },
    { name: 'status', path: '/api/status/all' }, // This is an API but we might want to check it
  ]
};

async function cleanupOldSessions(baseDir) {
  if (!fs.existsSync(baseDir)) return;
  
  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'latest' && dirent.name !== 'smoke-tests')
    .map(dirent => ({ name: dirent.name, path: path.join(baseDir, dirent.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (entries.length > CONFIG.MAX_SESSIONS) {
    const toDelete = entries.slice(0, entries.length - CONFIG.MAX_SESSIONS);
    console.log(`🧹 Housekeeping: Found ${entries.length} sessions. Keeping latest ${CONFIG.MAX_SESSIONS}. Removing ${toDelete.length} oldest...`);
    for (const entry of toDelete) {
      fs.rmSync(entry.path, { recursive: true, force: true });
    }
  }
}

async function captureRoute(appUrl, route, sessionDir, mode = 'full') {
  const rawUrl = process.env.BROWSERLESS_URL || '';
  const wsUrlBase = `${rawUrl.replace(/^https?:\/\//, 'wss://')}?token=${process.env.BROWSERLESS_TOKEN}`;
  const launchArgs = Buffer.from(JSON.stringify({ args: ['--window-size=1920,1080'] })).toString('base64');
  const wsUrl = `${wsUrlBase}&launch=${launchArgs}`;

  let browser;
  try {
    console.log(`🌐 Connecting for ${route.name}...`);
    browser = await chromium.connectOverCDP(wsUrl);
    
    const context = await browser.newContext({
      userAgent: CONFIG.USER_AGENT,
      viewport: CONFIG.VIEWPORT
    });
    await context.setExtraHTTPHeaders(CONFIG.HEADERS);
    
    const page = await context.newPage();

    if (route.name.startsWith('warden')) {
      console.log(`  🔐 Authenticating...`);
      await page.goto(`${appUrl}/warden-gate`, { waitUntil: 'networkidle', timeout: CONFIG.TIMEOUTS.NAVIGATION });
      await page.fill('input[name="username"]', process.env.ADMIN_USERNAME || 'admin');
      await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'password');
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle' }),
      ]);
    }

    const fullPath = route.path.startsWith('http') ? route.path : `${appUrl}${route.path}`;
    console.log(`  📸 Navigating to ${fullPath}...`);
    await page.goto(fullPath, { waitUntil: 'networkidle', timeout: CONFIG.TIMEOUTS.NAVIGATION });
    
    if (route.name.startsWith('warden')) {
      const isLoaded = await page.evaluate(() => document.body?.getAttribute('data-loaded') === 'true');
      if (!isLoaded) {
        await page.waitForSelector('body[data-loaded="true"]', { timeout: CONFIG.TIMEOUTS.SELECTOR });
      }
      
      const actualRoute = await page.evaluate(() => document.body?.getAttribute('data-route'));
      if (actualRoute !== route.name) {
        throw new Error(`Route mismatch: Expected ${route.name}, but found ${actualRoute || 'none'}. Possible redirect.`);
      }
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }

    const category = route.name.startsWith('warden') ? 'warden' : 'core';
    const categoryDir = path.join(sessionDir, category);
    if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });

    const screenshotPath = path.join(categoryDir, `${route.name}.png`);
    await page.screenshot({ path: screenshotPath });
    
    if (mode === 'full') {
      const htmlPath = path.join(categoryDir, `${route.name}.html`);
      fs.writeFileSync(htmlPath, await page.content());
      
      const metaPath = path.join(categoryDir, `${route.name}.meta.json`);
      fs.writeFileSync(metaPath, JSON.stringify({
        expected_route: route.name,
        actual_route: await page.evaluate(() => document.body?.getAttribute('data-route')),
        timestamp: new Date().toISOString()
      }, null, 2));
    }
    
    console.log(`  ✅ Saved ${route.name} assets.`);
    return true;
  } catch (err) {
    console.error(`  ❌ Failed ${route.name}: ${err.message}`);
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

(async () => {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode smoke') ? 'smoke' : 'full';
  const label = args.find(arg => arg.startsWith('--label '))?.split(' ')[1] || 'audit';
  
  console.log(`🚀 Starting Visual Audit [Mode: ${mode}] [Label: ${label}]...`);
  
  let ltProcess;
  try {
    const ltProcessSpawn = spawn('lt', ['--port', CONFIG.PORT.toString()]);
    ltProcess = ltProcessSpawn;
    
    const appUrl = await new Promise((resolve, reject) => {
      ltProcessSpawn.stdout.on('data', (data) => {
        const match = data.toString().match(/https?:\/\/[^\s]+\.loca\.lt/);
        if (match) resolve(match[0]);
      });
      setTimeout(() => reject(new Error('LT Timeout')), CONFIG.TIMEOUTS.TUNNEL);
    });
    console.log(`✅ Tunnel Live: ${appUrl}`);

    // 1. Housekeeping
    const baseScreenshotDir = 'visual-loop/screenshots';
    if (!fs.existsSync(baseScreenshotDir)) fs.mkdirSync(baseScreenshotDir, { recursive: true });
    await cleanupOldSessions(baseScreenshotDir);

    // 2. Discovery
    console.log(`🔍 Discovering routes...`);
    const response = await axios.get(`${appUrl}/api/visual-loop/routes`);
    const wardenRoutesRaw = response.data;
    
    const routes = [];
    
    // Add Core routes
    for (const core of CONFIG.CORE_ROUTES) {
      routes.push({ ...core, path: `${appUrl}${core.path}` });
    }
    
    // Add Warden routes
    for (const [name, path] of Object.entries(wardenRoutesRaw)) {
      routes.push({ name, path: `${appUrl}${path}` });
    }

    console.log(`🗺️  Route Map Loaded:`);
    console.log(`------------------------------------------`);
    console.log(`Route Name           | Path`);
    console.log(`------------------------------------------`);
    routes.forEach(r => console.log(`${r.name.padEnd(20)} | ${r.path}`));
    console.log(`------------------------------------------`);

    // 3. Session Setup
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace('Z', '');
    const sessionDir = mode === 'smoke' 
      ? path.join(baseScreenshotDir, 'smoke-tests') 
      : path.join(baseScreenshotDir, `${timestamp}_${label}`);
    
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    // 4. Capture Loop
    for (const route of routes) {
      let success = false;
      for (let i = 0; i < 3 && !success; i++) {
        if (i > 0) console.log(`  🔄 Retry ${i} for ${route.name}...`);
        success = await captureRoute(appUrl, route, sessionDir, mode);
        if (!success) await new Promise(r => setTimeout(r, 5000));
      }
      if (!success) console.error(`  🛑 Permanently failed ${route.name}`);
    }

    // 5. Mirror to Latest
    if (mode === 'full') {
      const latestDir = path.join(baseScreenshotDir, 'latest');
      if (fs.existsSync(latestDir)) fs.rmSync(latestDir, { recursive: true, force: true });
      
      // Simple copy instead of symlink for portability
      const copyDir = (src, dest) => {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(file => {
          const srcPath = path.join(src, file);
          const destPath = path.join(dest, file);
          if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        });
      };
      copyDir(sessionDir, latestDir);
      console.log(`✨ Mirroring results to screenshots/latest/`);
    }

    console.log('\n✨ Visual Audit Complete.');
  } catch (error) {
    console.error('\n🛑 Critical Error:', error);
  } finally {
    if (ltProcess) ltProcess.kill();
    process.exit();
  }
})();
