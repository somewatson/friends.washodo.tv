import axios from 'axios';

const API_URL = process.env.VERIFY_API_URL || 'http://localhost:3000';
const API_KEY = process.env.VERIFY_API_KEY || process.env.API_KEY;

async function runTest(name: string, testFn: () => Promise<void>) {
    console.log(`Running test: ${name}...`);
    try {
        await testFn();
        console.log(`✅ PASS: ${name}`);
        return true;
    } catch (error: any) {
        console.error(`❌ FAIL: ${name}`);
        console.error(`   Reason: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log(`Starting verification for API at: ${API_URL}`);
    if (!API_KEY) {
        console.warn('⚠️ WARNING: No API key provided (VERIFY_API_KEY or API_KEY). Authentication tests may fail if the server requires one.');
    }

    const results = [];

    // Test 1: Connectivity
    results.push(await runTest('Connectivity', async () => {
        await axios.get(`${API_URL}/api/status/test-user`, { 
            timeout: 5000,
            validateStatus: () => true // Consider any response as "reachable"
        });
    }));

    // Test 2: Authentication (No Key)
    results.push(await runTest('Authentication (No Key)', async () => {
        const response = await axios.get(`${API_URL}/api/status/twitch`, {
            headers: {},
            validateStatus: (status) => status === 401
        });
        if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
    }));

    // Test 3: Authentication (Invalid Key)
    results.push(await runTest('Authentication (Invalid Key)', async () => {
        const response = await axios.get(`${API_URL}/api/status/twitch`, {
            headers: { 'X-API-KEY': 'wrong-key' },
            validateStatus: (status) => status === 401
        });
        if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
    }));

    // Test 4: Functional API Response
    results.push(await runTest('Functional API Response', async () => {
        if (!API_KEY) throw new Error('API_KEY is required for this test');
        const response = await axios.get(`${API_URL}/api/status/twitch`, {
            headers: { 'X-API-KEY': API_KEY },
            timeout: 10000
        });
        
        const data = response.data;
        if (!data.username || data.isLive === undefined || data.lastLive === undefined) {
            throw new Error('Response missing expected fields (username, isLive, lastLive)');
        }
    }));

    const allPassed = results.every(r => r === true);
    if (allPassed) {
        console.log('\n✨ All verification tests passed!');
        process.exit(0);
    } else {
        console.error('\n🚨 Some verification tests failed.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Unexpected error during verification:', err);
    process.exit(1);
});
