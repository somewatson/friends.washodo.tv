import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
    console.log('Starting Port Conflict Test...');
    
    // We'll use ts-node to run the server. 
    // First, we need a simple entry point that just starts the server.
    const entryPoint = 'test_entry.ts';
    fs.writeFileSync(entryPoint, `
import { ApiServer } from './src/server';
const server = new ApiServer();
server.start();
    `);

    console.log('Launching first instance...');
    const instance1 = spawn('npx', ['ts-node', entryPoint]);
    
    instance1.stdout.on('data', (data) => {
        console.log(`[Instance 1]: ${data.toString().trim()}`);
    });

    // Give instance 1 a moment to bind to the port
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\nLaunching second instance (this should conflict)...');
    const instance2 = spawn('npx', ['ts-node', entryPoint]);

    instance2.stdout.on('data', (data) => {
        console.log(`[Instance 2 STDOUT]: ${data.toString().trim()}`);
    });

    instance2.stderr.on('data', (data) => {
        console.log(`[Instance 2 STDERR]: ${data.toString().trim()}`);
    });

    instance2.on('close', (code) => {
        console.log(`\nInstance 2 exited with code: ${code}`);
        if (code === 1) {
            console.log('✅ SUCCESS: Second instance exited with code 1 as expected.');
        } else {
            console.log('❌ FAILURE: Second instance did not exit with code 1.');
        }
        
        // Clean up
        console.log('Cleaning up...');
        instance1.kill();
        if (fs.existsSync(entryPoint)) fs.unlinkSync(entryPoint);
        process.exit(code === 1 ? 0 : 1);
    });
}

runTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
