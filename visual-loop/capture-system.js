const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
require('dotenv').config({ path: 'visual-loop/.env' });

/**
 * Fully Autonomous Visual Feedback Loop Runner
 * 
 * Lifecycle:
 * 1. Tunnel Discovery: Spawns LocalTunnel and scrapes the actual public URL.
 * 2. Stack Verification: Validates App, Browserless HTTP, and Browserless WS.
 * 3. Capture Sequence: Bypass -> Auth -> UI-based Navigation -> Route Verification -> Screenshot.
 */

const VIEWPORTS = {
    desktop: { width: 1920, height: 1080 },
    productivity: { width: 1280, height: 1440 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
};

async function establishTunnel() {
    console.log('🌐 Establishing LocalTunnel...');
    
    try { execSync('pkill -f localtunnel'); } catch (e) {}

    const logFile = 'visual-loop/tunnel.log';
    const lt = spawn('npx', ['localtunnel', '--port', '4000'], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    const writeStream = fs.createWriteStream(logFile);
    lt.stdout.pipe(writeStream);
    lt.stderr.pipe(writeStream);
    lt.unref();

    console.log('⏳ Waiting for tunnel URL discovery...');
    let tunnelUrl = null;
    let attempts = 0;

    while (!tunnelUrl && attempts < 20) {
        await new Promise(r => setTimeout(r, 1000));
        const logs = fs.readFileSync(logFile, 'utf8');
        const match = logs.match(/your url is: (https:\/\/[\w-]+\.loca\.lt)/);
        if (match) {
            tunnelUrl = match[1];
        }
        attempts++;
    }

    if (!tunnelUrl) {
        throw new Error('Failed to discover LocalTunnel URL. Check tunnel.log');
    }

    console.log(`✅ Tunnel active at: ${tunnelUrl}`);
    return tunnelUrl;
}

async function verifyStack(tunnelUrl) {
    console.log('--- 🛠️ Verifying Stack Health ---');
    const BROWSERLESS_URL = process.env.BROWSERLESS_URL || '';
    const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '';
    const API_KEY = process.env.API_KEY || '';

    try {
        await axios.get('http://localhost:4000');
        console.log('✅ App Server: Online');
    } catch (e) {
        throw new Error('App Server (localhost:4000) is offline. Please run "npm run dev".');
    }

    if (API_KEY) {
        try {
            await axios.get(`${tunnelUrl}/api/health`, { 
                headers: { 'X-API-KEY': API_KEY },
                timeout: 5000 
            });
            console.log('✅ API Auth: Valid');
        } catch (e) {
            console.warn(`⚠️ API Pre-flight check failed: ${e.message}. Proceeding to browser auth...`);
        }
    }

    try {
        await axios.get(tunnelUrl, { timeout: 5000 });
        console.log(`✅ Tunnel Reachable: ${tunnelUrl}`);
    } catch (e) {
        console.warn(`⚠️ Tunnel responded with error (might be LT landing page), proceeding...`);
    }

    try {
        await axios.get(`${BROWSERLESS_URL}/pressure?token=${BROWSERLESS_TOKEN}`);
        console.log('✅ Browserless HTTP: Online');
    } catch (e) {
        throw new Error(`Browserless HTTP offline or unauthorized: ${e.message}`);
    }

    try {
        const wsUrl = BROWSERLESS_URL.replace(/^https?:\/\//, 'wss://') + 
                      (BROWSERLESS_URL.includes('?') ? '&' : '?') + 
                      `token=${BROWSERLESS_TOKEN}`;
        const browser = await chromium.connectOverCDP(wsUrl);
        await browser.close();
        console.log('✅ Browserless WebSocket: Connected');
    } catch (e) {
        if (e.message.includes('0.0.0.0')) {
            throw new Error('Browserless returning internal IP. Check EXTERNAL env var in docker-compose.');
        }
        throw new Error(`Browserless WebSocket failed: ${e.message}`);
    }
    console.log('--- ✅ Stack Healthy ---\\n');
}

async function capturePage(tunnelUrl, targetRoute, viewportKey = 'desktop') {
    const BROWSERLESS_URL = process.env.BROWSERLESS_URL || '';
    const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '';
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'password';
    
    const wsUrl = BROWSERLESS_URL.replace(/^https?:\/\//, 'wss://') + 
                  (BROWSERLESS_URL.includes('?') ? '&' : '?') + 
                  `token=${BROWSERLESS_TOKEN}`;

    const screenshotDir = `visual-loop/screenshots/warden-${targetRoute}-baseline`;
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    let browser;
    try {
        console.log(`🌐 Connecting to Browserless for ${viewportKey} view...`);
        browser = await chromium.connectOverCDP(wsUrl);
        
        const context = await browser.newContext({ 
            viewport: VIEWPORTS[viewportKey],
            extraHTTPHeaders: { 
                'ngrok-skip-browser-warning': 'true',
                'bypass-tunnel-reminder': 'true',
                'User-Agent': 'WashodoWard-VisualLoop-Bot/1.0'
            }
        });
        
        const page = await context.newPage();
        console.log('🌐 LocalTunnel bypass header and custom User-Agent applied.');

        console.log(`🔐 Authenticating at ${tunnelUrl}/warden-gate...`);
        await page.goto(`${tunnelUrl}/warden-gate`, { waitUntil: 'networkidle' });
        
        try {
            await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 15000 });
        } catch (e) {
            console.error('❌ Auth page failed to load username input. Current URL:', page.url());
            const content = await page.content();
            fs.writeFileSync('visual-loop/screenshots/debug-gate-content.html', content);
            console.error('👉 Saved page content to visual-loop/screenshots/debug-gate-content.html for debugging.');
            throw e;
        }

        await page.fill('input[name="username"]', ADMIN_USER);
        await page.fill('input[name="password"]', ADMIN_PASS);
        
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle' }),
        ]);

        if (page.url().includes('/warden-gate')) {
            throw new Error('Authentication failed: Redirected back to login page.');
        }

        const cookies = await context.cookies();
        console.log(`🍪 Session Cookies: ${cookies.length} found`);
        const authCookie = cookies.find(c => c.name.includes('auth'));
        if (!authCookie) {
            console.warn('⚠️ Warning: No auth cookie detected. The session may be unstable.');
        } else {
            console.log(`✅ Auth cookie detected: ${authCookie.name}`);
        }

        await new Promise(r => setTimeout(r, 1000));

        // UI-BASED NAVIGATION (BEST PRACTICE)
        console.log(`🖱️ Navigating to ${targetRoute} via UI interaction...`);
        
        // Target the navigation button that matches the route name
        // We assume the buttons have a predictable pattern or we can find them by text
        const navButtonSelector = `a[href*="${targetRoute}"]`;
        
        try {
            await page.waitForSelector(navButtonSelector, { timeout: 10000 });
            await Promise.all([
                page.click(navButtonSelector),
                page.waitForNavigation({ waitUntil: 'networkidle' }),
            ]);
        } catch (e) {
            console.warn(`⚠️ UI button ${navButtonSelector} not found. Falling back to direct navigation.`);
            await page.goto(`${tunnelUrl}/warden/${targetRoute}`, { waitUntil: 'networkidle' });
        }
        
        try {
            await page.waitForSelector('body[data-loaded="true"]', { timeout: 20000 });
            
            const route = await page.getAttribute('body', 'data-route');
            if (route !== targetRoute) {
                throw new Error(`Route Mismatch! Expected ${targetRoute} but found ${route}.`);
            }
            console.log(`✅ Route verified: ${route}`);
        } catch (e) {
            console.error(`❌ Page verification failed: ${e.message}`);
            const content = await page.content();
            fs.writeFileSync(`visual-loop/screenshots/error-${targetRoute}-${viewportKey}.html`, content);
            throw e;
        }
        
        const fileName = viewportKey === 'desktop' ? 'baseline.png' : `${viewportKey}.png`;
        await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: true });
        
        const htmlFileName = viewportKey === 'desktop' ? 'baseline.html' : `${viewportKey}.html`;
        fs.writeFileSync(path.join(screenshotDir, htmlFileName), await page.content());
        
        console.log(`✅ Captured ${viewportKey} view to ${screenshotDir}`);

    } catch (err) {
        if (err.message.includes('502') || err.message.includes('Bad Gateway')) {
            console.warn(`⚠️ LocalTunnel 502 detected. This is often transient.`);
        }
        throw err;
    } finally {
        if (browser) await browser.close();
    }
}

async function runCaptureWithRetries(tunnelUrl, targetRoute, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            for (const viewportKey of Object.keys(VIEWPORTS)) {
                await capturePage(tunnelUrl, targetRoute, viewportKey);
            }
            return;
        } catch (err) {
            console.error(`\\n❌ Attempt ${i + 1} failed: ${err.message}`);
            if (i < maxRetries - 1) {
                const delay = Math.pow(2, i) * 2000;
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
}

(async () => {
    try {
        const tunnelUrl = await establishTunnel();
        await verifyStack(tunnelUrl);
        await runCaptureWithRetries(tunnelUrl, 'system');
        console.log(`\\n✨ SUCCESS: Full visual baseline captured for /warden/system`);
    } catch (err) {
        console.error(`\\n🛑 PIPELINE ABORTED: ${err.message}`);
        process.exit(1);
    }
})();
