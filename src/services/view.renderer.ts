import fs from 'fs/promises';
import path from 'path';

export class ViewRenderer {
    private static layoutPath = path.join(__dirname, '../../public/layout.html');
    private static pagesPath = path.join(__dirname, '../../public/pages');

    /**
     * Renders a page by wrapping its content in the global layout.
     * @param pageName The name of the HTML file in public/pages/ (without .html)
     * @param data Key-value pairs to replace in the page template
     * @param envBanner Include the environment banner?
     */
    static async render(pageName: string, data: Record<string, string> = {}, envBanner: boolean = true): Promise<string> {
        let layout = await fs.readFile(this.layoutPath, 'utf8');
        let content = '';

        try {
            content = await fs.readFile(path.join(this.pagesPath, `${pageName}.html`), 'utf8');
        } catch (e) {
            console.error(`[ViewRenderer] Could not find page: ${pageName}.html`);
            content = '<h1>404 Not Found</h1><p>The requested page was not found.</p>';
        }

        // Replace placeholders in content
        for (const [key, value] of Object.entries(data)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        // Wrap content in layout
        let rendered = layout.replace('{{content}}', content);

        // Inject Env Banner if requested
        if (envBanner) {
            rendered = this.injectEnvBanner(rendered);
        }

        return rendered;
    }

    private static injectEnvBanner(template: string): string {
        const env = process.env.APP_ENV;
        if (!env || env === 'production') return template;

        const bannerHtml = `
            <div id="env-banner" style="position: fixed; top: 0; left: 0; width: 100%; background: #a970ff; color: white; text-align: center; padding: 5px 0; font-size: 0.75rem; font-weight: bold; z-index: 1000; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                Running in ${env.toUpperCase()} mode
            </div>
            <style>
                body { padding-top: 25px !important; }
            </style>
        `;

        if (template.includes('<body style="position: relative;">')) {
            return template.replace('<body style="position: relative;">', `<body style="position: relative;">${bannerHtml}`);
        } else if (template.includes('<body>')) {
            return template.replace('<body>', `<body>${bannerHtml}`);
        }
        
        return template;
    }
}
