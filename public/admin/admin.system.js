async function renderLogs(container) {
    container.innerHTML = `
        <div class="card">
            <div class="form-group">
                <label>Filter by Type:</label>
                <select id="log-type-filter" onchange="filterLogs(this.value)">
                    <option value="">All Logs</option>
                    <option value="BOOT">Boot & Init</option>
                    <option value="STREAMER_CHECK">Streamer Checks</option>
                    <option value="DISCORD_CHAT">Discord Chats</option>
                    <option value="MATTERMOST_CHAT">Mattermost Chats</option>
                    <option value="SYSTEM">System</option>
                    <option value="ERROR">Errors</option>
                </select>
                <button class="btn-primary" onclick="refreshLogs()">Refresh</button>
            </div>
            <div class="table-responsive">
                <table id="logs-table">
                    <thead>
                        <tr style="text-align: left;">
                            <th>Timestamp</th>
                            <th>Type</th>
                            <th>Level</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;
    refreshLogs();
}

async function renderDiscordLogs(container) {
    container.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0;">Recent Interactions</h3>
                    <p style="color: #888; margin: 5px 0 0 0;">Latest messages and commands received from Discord servers.</p>
                </div>
                <button class="btn-primary" onclick="refreshDiscordLogs()">Refresh</button>
            </div>
            <div id="discord-logs-container" style="display: flex; flex-direction: column; gap: 12px;">
                <!-- Interaction cards injected here -->
            </div>
        </div>
    `;
    refreshDiscordLogs();
}

async function refreshDiscordLogs() {
    const container = document.getElementById('discord-logs-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding: 20px;">Loading logs...</div>';

    try {
        const logs = await api('/api/admin/discord/logs');
        if (logs.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 20px;">No interaction logs found.</div>';
            return;
        }
        container.innerHTML = logs.map(l => {
            const formattedContent = l.content.replace(/\\n/g, '\n');
            const timestamp = l.timestamp ? new Date(l.timestamp).toLocaleString() : 'Unknown';
            
            return `
                <div class="interaction-card" style="background: rgba(0,0,0,0.2); border-left: 4px solid var(--accent-color, #a970ff); border-radius: 4px; padding: 12px; border-top: 1px solid #444; border-right: 1px solid #444; border-bottom: 1px solid #444;">
                    <div class="interaction-header" style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; font-size: 0.85em;">
                        <div>
                            <strong style="color: #fff; margin-right: 8px;">${l.username}</strong>
                            <span style="color: #888;">${l.guild_name} <span style="color: #555;">»</span> ${l.channel_name}</span>
                        </div>
                        <span style="color: #666; font-family: monospace;">${timestamp}</span>
                    </div>
                    <div class="interaction-body" style="font-family: inherit; color: #ddd; line-height: 1.5; white-space: pre-wrap; margin-bottom: 8px;">${formattedContent}</div>
                    ${l.command ? `
                        <div class="interaction-footer" style="display: flex; justify-content: flex-end;">
                            <span class="status-pill pill-discord" style="font-size: 0.7em; background: var(--accent-color, #a970ff); color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${l.command}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        notify('Error loading Discord logs: ' + e.message, 'error');
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: red;">Failed to load logs.</div>';
    }
}

async function refreshLogs() {
    const type = document.getElementById('log-type-filter')?.value || '';
    const tbody = document.querySelector('#logs-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading logs...</td></tr>';

    try {
        const logs = await api(`/api/admin/logs${type ? '?type=' + encodeURIComponent(type) : ''}`);
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(l => `
            <tr>
                <td style="font-family: monospace; font-size: 0.85em;">${l.timestamp ? new Date(l.timestamp).toLocaleString() : 'Unknown'}</td>
                <td><span class="status-pill pill-${l.type.toLowerCase()}">${l.type}</span></td>
                <td style="color: ${l.level === 'ERROR' ? 'var(--danger-color)' : l.level === 'WARN' ? '#fbbf24' : 'inherit'}">${l.level}</td>
                <td style="font-family: monospace; white-space: pre-wrap;">${l.message}</td>
            </tr>
        `).join('');
    } catch (e) {
        notify('Error loading logs: ' + e.message, 'error');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Failed to load logs.</td></tr>';
    }
}

async function filterLogs(type) {
    await refreshLogs();
}

async function exportDb() {
    const res = await fetch(`${BASE_URL}/api/admin/db/export`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'twitchwatch_db_export.json';
    a.click();
}

async function importDb() {
    const fileInput = document.getElementById('import-file');
    if (!fileInput.files[0]) {
        notify('Please select a file', 'error');
        return;
    }
    try {
        const text = await fileInput.files[0].text();
        const json = JSON.parse(text);
        await api('/api/admin/db/import', 'POST', json);
        notify('Database imported successfully!');
    } catch (e) {
        notify('Import failed: ' + e.message, 'error');
    }
}

async function renderSystem(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Database Maintenance</h3>
            <p style="color: #888; margin-bottom: 20px;">Export or import the application state. Be careful when importing.</p>
            <div class="form-group">
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px;">
                    <button class="btn-primary" onclick="exportDb()">📤 Export Database</button>
                    <span style="color: #888; font-size: 0.9em;">Saves all tracked streamers and configs to a JSON file.</span>
                </div>
                <hr style="border: 0; border-top: 1px solid #444; margin: 20px 0;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="file" id="import-file" accept=".json" style="color: white;">
                    <button class="btn-danger" onclick="importDb()">📥 Import Database</button>
                </div>
                <p style="color: #aaa; font-size: 0.8em; margin-top: 10px;">Warning: Importing will overwrite current state.</p>
            </div>
        </div>
    `;
}
