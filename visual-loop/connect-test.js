const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
require('dotenv').config({ path: 'visual-loop/.env' });

async function setupTunnel() {
  const token = process.env.NGROK_AUTHTOKEN;
  if (!token) throw new Error('NGROK_AUTHTOKEN not found in .env');

  console.log('Configuring ngrok auth token...');
  try {
    execSync('./bin/ngrok config add-authtoken ' + token);
  } catch (e) {
    console.log('Auth token might already be set or failed: ' + e.message);
  }

  console.log('Starting ngrok tunnel for localhost:3000...');
  const ngrokProcess = spawn('./bin/ngrok', ['http', '3000'], {
    detached: true,
    stdio: 'ignore'
  });
  ngrokProcess.unref();
  
  await new Promise(resolve => setTimeout(resolve, 7000));

  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (!response.ok) throw new Error(`Ngrok API responded with ${response.status}`);
    const data = await response.json();
    if (!data.tunnels || data.tunnels.length === 0) {
      throw new Error('No active ngrok tunnels found.');
    }
    const publicUrl = data.tunnels[0].public_url;
    console.log(`🚀 App tunnel established: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Failed to retrieve public URL from ngrok API: ' + error.message);
    throw error;
  }
}

async function testConnection(appUrl) {
  const rawUrl = process.env.BROWSERLESS_URL || '';
  const baseBrowserlessUrl = rawUrl.replace(/^https?:\/\//, 'wss://');
  const token = process.env.BROWSERLESS_TOKEN;
  
  if (!token) throw new Error('BROWSERLESS_TOKEN not found in .env');
  
  const wsUrl = `${baseBrowserlessUrl}?token=${token}`;

  console.log(`Connecting to Browserless: ${wsUrl}`);
  
  try {
    // Use connect options to avoid potential "undefined" object errors
    const browser = await chromium.connectOverCDP(wsUrl);
    console.log('✅ Successfully connected to Browserless via CDP!');
    
    const context = browser.contexts().length > 0 
      ? browser.contexts()[0] 
      : await browser.newContext();

    const page = await context.newPage();
    console.log(`Navigating to App: ${appUrl}`);
    
    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 60000 });
    
    const title = await page.title();
    console.log(`✅ Page loaded! Title: ${title}`);
    
    await browser.close();
    return true;
  } catch (error) {
    console.error('❌ Connection/Navigation failed:');
    console.error(error);
    return false;
  }
}

(async () => {
  try {
    const appUrl = await setupTunnel();
    const success = await testConnection(appUrl);
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Critical Setup Error:');
    console.error(error);
    process.exit(1);
  }
})();
