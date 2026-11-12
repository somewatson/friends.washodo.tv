const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: 'visual-loop/.env' });

async function waitForApp() {
  console.log('Waiting for app to start on port 3001...');
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('http://localhost:3001');
      if (res.ok || res.status === 401 || res.status === 404) {
        console.log('✅ App is live on port 3001!');
        return true;
      }
    } catch (e) {
      // App not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('App failed to start on port 3001 within timeout.');
}

async function run() {
  console.log('🚀 Starting Visual Feedback Loop Orchestration...');
  
  // 1. Start the app in the background
  console.log('Starting dev server...');
  const appProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
    detached: true,
    stdio: 'ignore'
  });
  appProcess.unref();

  try {
    // 2. Wait for app to be responsive
    await waitForApp();

    // 3. Run the audit script
    console.log('Running audit scripts...');
    // We use execSync here to wait for the audit to finish and see the output
    execSync('node visual-loop/audit-pages.js', { stdio: 'inherit' });
    
    console.log('✅ Audit completed successfully.');
  } catch (error) {
    console.error('❌ Orchestration failed:');
    console.error(error);
  } finally {
    // 4. Cleanup
    console.log('Cleaning up processes...');
    try {
      // Kill app and any lingering ngrok processes
      execSync('pkill -f "nodemon src/index.ts" || true');
      execSync('pkill ngrok || true');
      console.log('Processes cleaned up.');
    } catch (e) {
      console.log('Cleanup error: ' + e.message);
    }
  }
}

run();
