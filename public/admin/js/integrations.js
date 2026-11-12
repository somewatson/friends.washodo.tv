async function renderIntegrations(container) {
    container.innerHTML = `
        <div class="card">
            <h3>🔌 General Integration Config</h3>
            <p style="color: #aaa; margin-bottom: 20px;">Central configuration for the Washodo bot identities across platforms.</p>
            <div class="form-group">
                <div style="display:flex; flex-direction:column; gap:5px">
                    <label>Bot Username</label>
                    <input type="text" id="int-username" placeholder="Bot Username">
                </div>
                <div style="display:flex; flex-direction:column; gap:5px">
                    <label>Bot Token</label>
                    <input type="text" id="int-token" placeholder="OAuth Token">
                </div>
                <div style="display:flex; flex-direction:column; gap:5px">
                    <label>Client ID</label>
                    <input type="text" id="int-client-id" placeholder="Client ID">
                </div>
                <div style="display:flex; flex-direction:column; gap:5px">
                    <label>Client Secret</label>
                    <input type="text" id="int-client-secret" placeholder="Client Secret">
                </div>
                <div style="display:flex; flex-direction:column; gap:5px">
                    <label>Base URL</label>
                    <input type="text" id="int-base-url" placeholder="https://...">
                </div>
                <div style="display:flex; align-items:center; gap:10px; margin-top:25px">
                    <label class="toggle-container">
                        <div class="switch">
                            <input type="checkbox" id="int-broadcast-enabled">
                            <span class="slider"></span>
                        </div>
                        <span>Enable Broadcasts</span>
                    </label>
                </div>
                <button class="btn-primary" style="margin-top:25px" onclick="saveIntegrations()">Save Configuration</button>
            </div>
        </div>

        <div class="card" style="border-left: 4px solid var(--secondary-color);">
            <h3>📚 Onboarding Guides</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div class="preview-section">
                    <h4>Discord Setup</h4>
                    <ol style="font-size: 0.85rem; color: #ccc; line-height: 1.6;">
                        <li>Create app in <a href="https://discord.com/developers/applications" target="_blank" style="color: var(--accent-color)">Dev Portal</a></li>
                        <li>Enable <strong>Message Content Intent</strong></li>
                        <li>Copy <strong>Bot Token</strong> from Bot tab</li>
                        <li>Copy <strong>Client ID/Secret</strong> from OAuth2 tab</li>
                    </ol>
                </div>
                <div class="preview-section">
                    <h4>Mattermost Setup</h4>
                    <ol style="font-size: 0.85rem; color: #ccc; line-height: 1.6;">
                        <li>Integrations &rarr; Incoming Webhooks</li>
                        <li>Integrations &rarr; Bot Accounts</li>
                        <li>Extract Channel ID from browser URL</li>
                        <li>Enter Server URL and Tokens above</li>
                    </ol>
                </div>
                <div class="preview-section">
                    <h4>Twitch Setup</h4>
                    <ol style="font-size: 0.85rem; color: #ccc; line-height: 1.6;">
                        <li>Create app in Twitch Dev Console</li>
                        <li>Generate token with <code style="background:#222; padding:2px 4px; border-radius:3px">chat:edit</code> and <code style="background:#222; padding:2px 4px; border-radius:3px">chat:read</code></li>
                        <li>Enter Client ID and Secret</li>
                        <li>Use a Bot account for the username</li>
                        <li><button class="btn-primary" style="margin-top:10px; font-size:0.8rem" onclick="connectTwitchOAuth()">Connect Twitch Bot (OAuth)</button></li>
                    </ol>
                </div>
            </div>
        </div>
    `;
    try {
        const config = await api('/api/admin/integrations');
        if (config) {
            document.getElementById('int-username').value = config.bot_username || '';
            document.getElementById('int-token').value = config.bot_token || '';
            document.getElementById('int-client-id').value = config.client_id || '';
            document.getElementById('int-client-secret').value = config.client_secret || '';
            document.getElementById('int-base-url').value = config.base_url || '';
            document.getElementById('int-broadcast-enabled').checked = config.is_broadcast_enabled === 1;
        }
    } catch (e) {
        notify('Error loading integrations: ' + e.message, 'error');
    }
}

async function saveIntegrations() {
    const body = {
        platform: 'washodo',
        bot_username: document.getElementById('int-username').value,
        bot_token: document.getElementById('int-token').value,
        client_id: document.getElementById('int-client-id').value,
        client_secret: document.getElementById('int-client-secret').value,
        base_url: document.getElementById('int-base-url').value,
        is_broadcast_enabled: document.getElementById('int-broadcast-enabled').checked,
        refresh_token: null
    };
    try {
        await api('/api/admin/integrations', 'POST', body);
        notify('Integration settings saved!');
    } catch (e) {
        notify('Save failed: ' + e.message, 'error');
    }
}

async function connectTwitchOAuth() {
    try {
        const res = await api('/api/twitch/auth');
        window.location.href = res.url;
    } catch (e) {
        notify('Failed to initiate Twitch OAuth: ' + e.message, 'error');
    }
}
