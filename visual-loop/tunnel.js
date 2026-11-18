const { Tunnel } = require('cloudflared');
require('dotenv').config();

(async () => {
  const PORT = 4000;
  console.log('🌐 Starting Cloudflare Tunnel Sidecar...');

  try {
    const tunnel = Tunnel.quick(`http://localhost:${PORT}`);

    await new Promise((resolve, reject) => {
      
      // DEBUG: Log everything from the cloudflared binary
      tunnel.on('stdout', (data) => {
        console.log(`[cloudflared STDOUT]: ${data}`);
      });

      tunnel.on('stderr', (data) => {
        console.error(`[cloudflared STDERR]: ${data}`);
      });

      tunnel.once('url', (url) => {
        console.log(`✅ Tunnel active: ${url}`);
        console.log('💡 Keep this terminal open to maintain the tunnel connection.');
      });

      tunnel.once('connected', (conn) => {
        console.log('✅ Connection established:', conn);
        console.log('⏳ Tunnel is now running in the background. Press Ctrl+C to stop.');
      });

      tunnel.on('exit', (code, signal) => {
        console.log(`🛑 Tunnel process exited with code ${code} (Signal: ${signal})`);
        resolve();
      });

      tunnel.on('error', (err) => {
        console.error(`❌ Tunnel Runtime Error: ${err.message}`);
      });
    });

  } catch (err) {
    console.error(`❌ Tunnel Initialization Error: ${err.message}`);
    process.exit(1);
  }
})();
