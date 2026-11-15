const { chromium } = require('playwright');
const { spawn } = require('child_process');
require('dotenv').config({ path: 'visual-loop/.env' });
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Starting MVP Visual Test (Header Bypass Edition)...');
  
  // 1. Start LocalTunnel
  const ltProcess = spawn('lt', ['--port', '3000']);
  let appUrl = null;

  const urlPromise = new Promise((resolve, reject) => {
    ltProcess.stdout.on('data', (data) => {
      const match = data.toString().match(/https?:\/\/[^\s]+\.loca\.lt/);
      if (match) resolve(match[0]);
    });
    setTimeout(() => reject(new Error('LT Timeout')), 15000);
  });

  try {
    appUrl = await urlPromise;
    console.log(`✅ Tunnel Live: ${appUrl}`);

    // 2. Connect to Browserless with window-size flag
    const rawUrl = process.env.BROWSERLESS_URL || '';
    const launchArgs = Buffer.from(JSON.stringify({ args: ['--window-size=1920,1080'] })).toString('base64');
    const wsUrl = `${rawUrl.replace(/^https?:\/\//, 'wss://')}?token=${process.env.BROWSERLESS_TOKEN}&launch=${launchArgs}`;
    const browser = await chromium.connectOverCDP(wsUrl);
    
    // Create a fresh context to set headers, User-Agent and 1080p viewport
    const context = await browser.newContext({
      userAgent: 'WashodoWard-VisualLoop-Bot/1.0', // Non-standard User-Agent to bypass LT
      viewport: { width: 1920, height: 1080 }
    });

    // Set the programmatic bypass header
    await context.setExtraHTTPHeaders({
      'Bypass-Tunnel-Reminder': 'true'
    });

    const page = await context.newPage();
    // Explicitly set viewport size again on the page
    await page.setViewportSize({ width: 1920, height: 1080 });
    console.log('✅ Connected to Browserless with Bypass Headers and 1080p Viewport');

    // 3. Capture Main Page
    console.log(`📸 Capturing ${appUrl}...`);
    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    const screenshotPath = path.join('visual-loop/screenshots', 'mvp-test-final.png');
    // Capture only the viewport to guarantee 1920x1080
    await page.screenshot({ path: screenshotPath });
    console.log(`✅ Screenshot saved to ${screenshotPath}`);

    await browser.close();
  } catch (e) {
    console.error('❌ MVP Test Failed:', e);
  } finally {
    ltProcess.kill();
    process.exit();
  }
})();
