const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: 'visual-loop/.env' });

async function waitForApp() {
  const port = process.env.PORT || 3000;
  console.log(`Waiting for app to start on port ${port}...`);
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status === 401 || res.status === 404) {
        console.log(`✅ App is live on port ${port}!`);
        return true;
      }
    } catch (e) {
      // App not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`App failed to start on port ${port} within timeout.`);
}

async function run() {
  console.log('🚀 Starting Visual Feedback Loop Orchestration...');
  
  // 1. State-Based Trigger / Cooldown
  const lastRunFile = path.join(__dirname, 'last-run.txt');
  if (fs.existsSync(lastRunFile)) {
    const lastRun = parseInt(fs.readFileSync(lastRunFile, 'utf8'));
    const cooldown = 30 * 60 * 1000; // 30 minute minimum interval to prevent token drain
    if (Date.now() - lastRun < cooldown) {
      console.log(`Skipping audit: Last run was less than 30 minutes ago.`);
      process.exit(0);
    }
  }

  // 2. Ensure Bot Runner is running (Decoupled)
  try {
    const botRunning = execSync('pgrep -f "bot-runner.ts" || pgrep -f "bot-runner.js"').toString().trim();
    console.log('✅ Bot runner is already active.');
  } catch (e) {
    console.log('Bot runner not found. Starting it in the background...');
    spawn('npm', ['run', 'start:discord'], {
      shell: true,
      detached: true,
      stdio: 'ignore'
    }).unref();
    // Give the bot a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 3. Start the app in the background
  console.log('Starting dev server...');
  const appProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
    detached: true,
    stdio: 'ignore'
  });
  appProcess.unref();

  try {
    // 3. Wait for app to be responsive
    await waitForApp();

    // 4. Run the audit script
    console.log('Running audit scripts...');
    execSync('node visual-loop/audit-pages.js', { stdio: 'inherit' });
    
    // Save successful run timestamp
    fs.writeFileSync(lastRunFile, Date.now().toString());
    
    console.log('✅ Audit completed successfully.');
  } catch (error) {
    console.error('❌ Orchestration failed:');
    console.error(error);
  } finally {
    // 5. Cleanup
    console.log('Cleaning up processes...');
    try {
      execSync('pkill -f "nodemon src/index.ts" || true');
      execSync('pkill ngrok || true');
      console.log('Processes cleaned up.');
    } catch (e) {
      console.log('Cleanup error: ' + e.message);
    }
  }
}

run();
