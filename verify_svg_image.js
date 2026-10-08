const axios = require('axios');
const fs = require('fs');

async function verify() {
    const content = fs.readFileSync('offline_preview.svg', 'utf8');
    const match = content.match(/href="([^"]+)"/);
    if (!match) {
        console.error('No href found in SVG');
        process.exit(1);
    }
    const url = match[1];
    console.log(`Verifying image URL: ${url}`);
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            console.log('Image URL is valid and reachable.');
        } else {
            console.error(`Image URL returned status: ${response.status}`);
            process.exit(1);
        }
    } catch (e) {
        console.error(`Error fetching image: ${e.message}`);
        process.exit(1);
    }
}
verify();
