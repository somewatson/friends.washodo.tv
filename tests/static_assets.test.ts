import * as fs from 'fs';
import * as path from 'path';

describe('Static Assets', () => {
    const htmlPath = path.join(__dirname, '../public/index.html');
    let htmlContent: string;

    beforeAll(() => {
        htmlContent = fs.readFileSync(htmlPath, 'utf8');
    });

    it('should contain the Umami analytics script with correct website-id', () => {
        const expectedScript = '<script defer src="https://beancounter.somewatson.com/script.js" data-website-id="cf5643bb-9645-4789-b5fd-a03e9944cf75"></script>';
        expect(htmlContent).toContain(expectedScript);
    });

    it('should contain the correct favicon link', () => {
        expect(htmlContent).toContain('<link rel="icon" type="image/png" href="/favicon.png">');
    });
});
