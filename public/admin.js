const API_KEY = window.WARDEN_API_KEY || '';
const BASE_URL = window.location.origin;

async function api(path, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 
            'X-API-KEY': API_KEY,
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${path}`, options);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const btn = document.querySelector('.collapse-btn span');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
    
    if (sidebar.classList.contains('collapsed')) {
        btn.textContent = '▶';
    } else {
        btn.textContent = '◀';
    }
}

function notify(message, type = 'success') {
    const toast = document.getElementById('notification-toast');
    toast.textContent = message;
    toast.className = type === 'success' ? 'toast-success' : 'toast-error';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

async function handlePageLoad() {
    document.body.dataset.loaded = 'false';
    const path = window.location.pathname;
    const contentArea = document.getElementById('content-area');
    const titleEl = document.getElementById('page-title');
    const descEl = document.getElementById('page-desc');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    let loadPromise = Promise.resolve();

    if (path === '/warden/streamers') {
        document.getElementById('nav-streamers').classList.add('active');
        titleEl.textContent = 'Manage Streamers';
        descEl.textContent = 'Add and organize tracked community members and friends.';
        loadPromise = renderStreamers(contentArea);
    } else if (path === '/warden/discord') {
        document.getElementById('nav-discord').classList.add('active');
        titleEl.textContent = 'Discord Integrations';
        descEl.textContent = 'Configure announcement channels for Discord servers.';
        loadPromise = Promise.all([renderDiscord(contentArea), updateDiscordGlobalStatus()]);
    } else if (path === '/warden/mattermost') {
        document.getElementById('nav-mattermost').classList.add('active');
        titleEl.textContent = 'Mattermost Configs';
        descEl.textContent = 'Configure webhooks for Mattermost servers.';
        loadPromise = renderMattermost(contentArea);
    } else if (path === '/warden/broadcasts') {
        document.getElementById('nav-broadcasts').classList.add('active');
        titleEl.textContent = 'Community Broadcasts';
        descEl.textContent = 'Manage global settings and scheduled announcements.';
        loadPromise = renderBroadcasts(contentArea);
    } else if (path === '/warden/system') {
        document.getElementById('nav-system').classList.add('active');
        titleEl.textContent = 'System Tools';
        descEl.textContent = 'Database maintenance and portability tools.';
        loadPromise = renderSystem(contentArea);
    } else if (path === '/warden/logs') {
        document.getElementById('nav-logs').classList.add('active');
        titleEl.textContent = 'Application Logs';
        descEl.textContent = 'Review system events grouped by type.';
        loadPromise = renderLogs(contentArea);
    } else {
        window.location.href = '/warden/streamers';
        return;
    }

    await loadPromise;
    document.body.dataset.loaded = 'true';
}

async function renderStreamers(container) {
    container.innerHTML = `
        <div class="card">
            <div class="form-group" style="position: relative;">
                <input type="text" id="streamer-user" placeholder="Username" oninput="handleUserSearch(this.value)">
                <div id="search-results" style="position: absolute; top: 100%; left: 0; width: 200px; background: #2d2d2d; border: 1px solid #555; border-radius: 4px; z-index: 1000; display: none; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"></div>
                <select id="streamer-cat">
                    <option value="member">Member</option>
                    <option value="friend">Friend</option>
                    <option value="streamer">Other Streamer</option>
                </select>
                <button class="btn-primary" onclick="addStreamer()">Add / Update</button>
            </div>
            <div class="table-responsive">
                <table id="streamers-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Category</th>
                            <th>Followers</th>
                            <th>Notify</th>
                            <th>Show</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const data = await api('/api/admin/streamers');
        const tbody = document.querySelector('#streamers-table tbody');
        tbody.innerHTML = data.map(s => `
            <tr class="draggable-row" data-username="${s.username}">
                <td><a href="${s.profileUrl}" target="_blank" style="color: white; text-decoration: none; font-weight: bold;">${s.username} ↗</a></td>
                <td><span class="status-pill pill-${s.category}">${s.category}</span></td>
                <td>${s.followerCount.toLocaleString()}</td>
                <td class="col-toggle text-center" onclick="toggleStreamerNotify('${s.username}', !${s.notify_enabled})">
                    <label class="switch">
                        <input type="checkbox" ${s.notify_enabled ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="col-toggle text-center" onclick="toggleStreamerShow('${s.username}', !${s.show_on_page})">
                    <label class="switch">
                        <input type="checkbox" ${s.show_on_page ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td><button class="btn-danger" onclick="removeStreamer('${s.username}')">Remove</button></td>
            </tr>
        `).join('');
        
        new Sortable(tbody, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function() {
                const rows = Array.from(tbody.querySelectorAll('.draggable-row'));
                const order = rows.map((row, index) => ({
                    username: row.getAttribute('data-username'),
                    orderIndex: index
                }));
                try {
                    await api('/api/admin/streamers/reorder', 'POST', { order });
                    notify('Order saved successfully!');
                } catch (e) {
                    notify('Failed to save order: ' + e.message, 'error');
                }
            }
        });
    } catch (e) {
        notify('Error loading streamers: ' + e.message, 'error');
    }
}

async function renderDiscord(container) {
    container.innerHTML = `
        <div class="card" id="discord-global-status-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0;">Global Connection Status</h3>
                    <div id="global-status-text" style="font-weight: bold; margin-top: 5px;">Checking...</div>
                </div>
                <button id="force-retry-btn" class="btn-primary" style="display: none;" onclick="forceRetryDiscord()">Force Retry Login</button>
            </div>
        </div>
        <div class="card">
            <p>Integrated servers creating the #📯-ward-bot channel.</p>
            <div class="form-group">
                <input type="text" id="discord-guild" placeholder="Guild ID">
                <input type="text" id="discord-channel" placeholder="Channel ID">
                <input type="text" id="discord-token" placeholder="Bot Token">
                <input type="text" id="discord-owner" placeholder="Owner ID (Optional)">
                <button class="btn-primary" onclick="addDiscord()">Add Integration</button>
            </div>
            <div class="table-responsive">
                <table id="discord-table">
                    <thead>
                        <tr>
                            <th>Server</th>
                            <th>Channel ID</th>
                            <th>Members</th>
                            <th>Owner</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const data = await api('/api/admin/discord');
        const tbody = document.querySelector('#discord-table tbody');
        tbody.innerHTML = data.map(d => `
            <tr>
                <td>
                    ${d.serverIcon ? `<img src="${d.serverIcon}" class="guild-icon" alt="">` : `<div class="guild-icon" style="display:inline-block"></div>`}
                    <strong>${d.serverName}</strong><br><small style="color: #888">${d.guild_id}</small>
                </td>
                <td>${d.channel_id}</td>
                <td class="text-center">${d.memberCount.toLocaleString()}</td>
                <td>${d.owner_id || 'System'}</td>
                <td class="col-toggle text-center" onclick="toggleDiscord('${d.guild_id}', !${d.is_active})">
                    <label class="switch">
                        <input type="checkbox" ${d.is_active ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td>
                    <button class="btn-success" onclick="testDiscord('${d.guild_id}')">Test</button>
                    <button class="btn-primary" onclick="syncDiscord('${d.guild_id}')">Sync</button>
                    <button class="btn-danger" onclick="removeDiscord('${d.guild_id}')">Remove</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        notify('Error loading Discord: ' + e.message, 'error');
    }
}

async function updateDiscordGlobalStatus() {
    try {
        const status = await api('/api/admin/discord/status');
        const statusTextEl = document.getElementById('global-status-text');
        const retryBtn = document.getElementById('force-retry-btn');
        
        if (!statusTextEl || !retryBtn) return;

        let statusHtml = '';
        if (status.rateLimited) {
            const retryAt = new Date(status.rateLimitUntil);
            const now = new Date();
            const diffMs = retryAt - now;
            const diffMins = Math.ceil(diffMs / 1000 / 60);
            
            statusHtml = `🔴 <span style="color: var(--danger-color)">Rate Limited</span><br>`;
            statusHtml += `<small>Last Ping: ${status.lastPing ? new Date(status.lastPing).toLocaleString() : 'Unknown'}</small><br>`;
            statusHtml += `<small>Retry after: ${status.retryAfter ? status.retryAfter + 's' : 'Unknown'}</small><br>`;
            statusHtml += `<small>Retry at: ${retryAt.toLocaleString()} (in ${diffMins}m)</small>`;
            retryBtn.style.display = 'block';
        } else if (status.disabled) {
            statusHtml = `🟡 <span style="color: #fbbf24">Disabled/Cooldown</span> - ${status.lastError || 'Unknown error'}`;
            retryBtn.style.display = 'block';
        } else if (status.connected) {
            statusHtml = `🟢 <span style="color: var(--success-color)">Operational</span> - ${status.botCount} bots connected`;
            retryBtn.style.display = 'none';
        } else {
            statusHtml = `⚪ <span style="color: #888">Disconnected</span>`;
            retryBtn.style.display = 'block';
        }

        if (status.sessionStatus) {
            const sessionDesc = status.sessionStatus === 'Cached' 
                ? 'Using a saved session token from the database for faster reconnection.' 
                : 'Using the primary bot token for a fresh authentication handshake.';
            statusHtml += `<br>Session: <strong title="${sessionDesc}">${status.sessionStatus}</strong> <span style="font-size: 0.8em; color: #aaa; cursor: help;" title="${sessionDesc}">ⓘ</span>`;
        }

        statusTextEl.innerHTML = statusHtml;
    } catch (e) {
        console.error('Error updating Discord status:', e);
    }
}

async function forceRetryDiscord() {
    try {
        await api('/api/admin/discord/retry', 'POST');
        notify('Discord login retry triggered!');
        updateDiscordGlobalStatus();
    } catch (e) {
        notify('Retry failed: ' + e.message, 'error');
    }
}

async function testDiscord(guildId) {
    try {
        await api(`/api/admin/discord/test/${guildId}`, 'POST');
        notify('Test message sent to Discord!');
    } catch (e) {
        notify('Discord test failed: ' + e.message, 'error');
    }
}

async function renderMattermost(container) {
    container.innerHTML = `
        <div class="card">
            <div class="form-group">
                <input type="text" id="mm-label" placeholder="Label (e.g. Main Server)">
                <input type="text" id="mm-url" placeholder="Server URL">
                <input type="text" id="mm-webhook" placeholder="Webhook Token">
                <input type="text" id="mm-bot" placeholder="Bot Token">
                <input type="text" id="mm-channel" placeholder="Channel ID">
                <button class="btn-primary" onclick="addMattermost()">Add Config</button>
            </div>
            <div class="table-responsive">
                <table id="mm-table">
                    <thead>
                        <tr>
                            <th>Label</th>
                            <th>URL</th>
                            <th>Channel</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const data = await api('/api/admin/mattermost');
        const tbody = document.querySelector('#mm-table tbody');
        tbody.innerHTML = data.map(m => `
            <tr>
                <td>
                    <div class="editable-container" id="mm-label-container-${m.id}">
                        <span class="editable-text" onclick="enterEditMode(${m.id}, '${m.label}')">${m.label}</span>
                    </div>
                </td>
                <td>${m.server_url}</td>
                <td>${m.channel_id}</td>
                <td class="col-toggle text-center" onclick="toggleMattermost(${m.id}, !${m.is_active})">
                    <label class="switch">
                        <input type="checkbox" ${m.is_active ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td>
                    <button class="btn-success" onclick="testMattermost(${m.id})">Test</button>
                    <button class="btn-danger" onclick="removeMattermost(${m.id})">Remove</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        notify('Error loading Mattermost: ' + e.message, 'error');
    }
}

async function toggleMattermost(id, active) {
    try {
        await api('/api/admin/mattermost/toggle', 'POST', { id, active });
        notify('Mattermost configuration status updated!');
    } catch (e) {
        notify('Failed to update Mattermost status: ' + e.message, 'error');
    }
}

async function testMattermost(id) {
    try {
        await api(`/api/admin/mattermost/test/${id}`, 'POST');
        notify('Test message sent to Mattermost!');
    } catch (e) {
        notify('Mattermost test failed: ' + e.message, 'error');
    }
}

async function removeMattermost(id) {
    if (!confirm('Are you sure you want to remove this configuration?')) return;
    await api('/api/admin/mattermost/' + id, 'DELETE');
    renderMattermost(document.getElementById('content-area'));
}

async function enterEditMode(id, currentLabel) {
    const container = document.getElementById(`mm-label-container-${id}`);
    container.innerHTML = `
        <input type="text" class="editable-input" id="edit-input-${id}" value="${currentLabel}">
        <button class="btn-primary btn-icon" onclick="saveMattermostLabel(${id})">💾</button>
        <button class="btn-danger btn-icon" onclick="renderMattermost(document.getElementById('content-area'))">❌</button>
    `;
    const input = document.getElementById(`edit-input-${id}`);
    input.focus();
    input.onkeydown = (e) => {
        if (e.key === 'Enter') saveMattermostLabel(id);
        if (e.key === 'Escape') renderMattermost(document.getElementById('content-area'));
    };
}

async function saveMattermostLabel(id) {
    const input = document.getElementById(`edit-input-${id}`);
    const newLabel = input.value;
    if (!newLabel.trim()) {
        notify('Label cannot be empty', 'error');
        return;
    }
    try {
        await api('/api/admin/mattermost/update', 'POST', { id, label: newLabel });
        notify('Label updated successfully!');
        renderMattermost(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to update label: ' + e.message, 'error');
    }
}

async function triggerBroadcastNow() {
    try {
        await api('/api/admin/broadcast-now', 'POST');
        notify('Broadcast triggered successfully!');
    } catch (e) {
        notify('Failed to trigger broadcast: ' + e.message, 'error');
    }
}

async function previewBroadcast() {
    try {
        const data = await api('/api/admin/broadcast-preview');
        const list = document.getElementById('preview-targets-list');
        
        if (data.announcements.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding: 20px;">No active announcements to broadcast.</div>';
        } else {
            let html = '<div class="preview-section"><h4 style="color: var(--accent-color)">📢 Active Broadcast Messages</h4>';
            html += data.announcements.map(a => `
                <div class="preview-item">
                    <span class="target-name">${a.text.substring(0, 80)}${a.text.length > 80 ? '...' : ''}</span>
                    <span class="target-id">D:${a.discord_enabled ? '✅' : '❌'} M:${a.mattermost_enabled ? '✅' : '❌'} T:${a.twitch_enabled ? '✅' : '❌'}</span>
                </div>
            `).join('');
            html += '</div>';

            if (data.targets.discord.length > 0) {
                html += '<div class="preview-section"><h4 style="color: var(--secondary-color)">💬 Discord Channels</h4><p style="font-size: 0.85em; color: #aaa; margin-bottom: 10px;">Active Discord servers and the specific channels where notifications are sent.</p>';
                html += data.targets.discord.map(t => `
                    <div class="preview-item">
                        <span class="target-name">${t.guildName} / ${t.channelName}</span>
                        <span class="target-id">${t.channelId}</span>
                    </div>
                `).join('');
                html += '</div>';
            }

            if (data.targets.mattermost.length > 0) {
                html += '<div class="preview-section"><h4 style="color: var(--secondary-color)">🏢 Mattermost Webhooks</h4><p style="font-size: 0.85em; color: #aaa; margin-bottom: 10px;">Active Mattermost server configurations and their designated webhook endpoints.</p>';
                html += data.targets.mattermost.map(t => `
                    <div class="preview-item">
                        <span class="target-name">${t.label}</span>
                        <span>${t.channelId}</span>
                    </div>
                `).join('');
                html += '</div>';
            }

            if (data.targets.discord.length === 0 && data.targets.mattermost.length === 0) {
                html += '<div class="preview-section"><h4 style="color: var(--danger-color)">⚠️ No active notification targets configured.</h4></div>';
            }

            list.innerHTML = html;
        }
        
        document.getElementById('broadcast-preview-modal').style.display = 'flex';
    } catch (e) {
        notify('Failed to fetch preview: ' + e.message, 'error');
    }
}

function closePreviewModal() {
    document.getElementById('broadcast-preview-modal').style.display = 'none';
}

let currentAnnId = null;
function openAnnouncementModal(id = null) {
    currentAnnId = id;
    const modal = document.getElementById('announcement-modal');
    modal.style.display = 'flex';
    if (id) {
        api('/api/admin/announcements').then(data => {
            const ann = data.find(a => a.id === id);
            if (ann) {
                document.getElementById('ann-text').value = ann.text;
                document.getElementById('ann-active').checked = !!ann.is_active;
                document.getElementById('ann-discord').checked = !!ann.discord_enabled;
                document.getElementById('ann-mattermost').checked = !!ann.mattermost_enabled;
                document.getElementById('ann-twitch').checked = !!ann.twitch_enabled;
                document.getElementById('ann-start').value = ann.start_date || '';
                document.getElementById('ann-end').value = ann.end_date || '';
                if (document.getElementById('ann-cron')) {
                    document.getElementById('ann-cron').value = ann.cron_schedule || '';
                    updateCronPreview();
                }
            }
        });
    } else {
        document.getElementById('ann-text').value = '';
        document.getElementById('ann-active').checked = true;
        document.getElementById('ann-discord').checked = true;
        document.getElementById('ann-mattermost').checked = true;
        document.getElementById('ann-twitch').checked = false;
        document.getElementById('ann-start').value = '';
        document.getElementById('ann-end').value = '';
    }
}

function closeModal() {
    document.getElementById('announcement-modal').style.display = 'none';
}

async function saveAnnouncement() {
    const body = {
        id: currentAnnId,
        text: document.getElementById('ann-text').value,
        order_index: 0,
        is_active: document.getElementById('ann-active').checked,
        discord_enabled: document.getElementById('ann-discord').checked,
        mattermost_enabled: document.getElementById('ann-mattermost').checked,
        twitch_enabled: document.getElementById('ann-twitch').checked,
        start_date: document.getElementById('ann-start').value || null,
        end_date: document.getElementById('ann-end').value || null,
        cron_schedule: document.getElementById('ann-cron')?.value || null
    };
    try {
        await api('/api/admin/announcements', 'POST', body);
        notify('Announcement saved successfully!');
        closeModal();
        renderBroadcasts(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to save announcement: ' + e.message, 'error');
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
        await api(`/api/admin/announcements/${id}`, 'DELETE');
        notify('Deleted successfully!');
        renderBroadcasts(document.getElementById('content-area'));
    } catch (e) {
        notify('Delete failed: ' + e.message, 'error');
    }
}

async function toggleAnnouncement(id, active) {
    const data = await api('/api/admin/announcements');
    const ann = data.find(a => a.id === id);
    if (ann) {
        await api('/api/admin/announcements', 'POST', { ...ann, is_active: active });
        notify('Status updated!');
        renderBroadcasts(document.getElementById('content-area'));
    }
}

async function toggleAnnouncementTarget(id, field, value) {
    try {
        const data = await api('/api/admin/announcements');
        const ann = data.find(a => a.id === id);
        if (ann) {
            const updatedValue = value ? 1 : 0;
            await api('/api/admin/announcements', 'POST', { ...ann, [field]: updatedValue });
            notify(`${field} updated!`);
            renderBroadcasts(document.getElementById('content-area'));
        }
    } catch (e) {
        notify('Failed to update target: ' + e.message, 'error');
    }
}

function applyCronPreset(presetKey) {
    const presets = {
        'hourly': '0 * * * *',
        'daily_noon': '0 12 * * *',
        'daily_midnight': '0 0 * * *',
        'weekly_mon': '0 0 * * 1',
        'every_6h': '0 */6 * * *',
    };
    const cronInput = document.getElementById('ann-cron');
    if (cronInput) {
        cronInput.value = presets[presetKey];
        updateCronPreview();
    }
}

async function updateCronPreview() {
    const cronInput = document.getElementById('ann-cron');
    const previewDiv = document.getElementById('cron-preview');
    if (!cronInput || !previewDiv) {
        return;
    }
    const cron = cronInput.value;
    if (!cron) {
        previewDiv.textContent = '';
        return;
    }
    const translation = translateCron(cron);
    
    try {
        const res = await api(`/api/admin/cron-next?schedule=${encodeURIComponent(cron)}`);
        const nextDate = new Date(res.next);
        const nextUTC = nextDate.toUTCString();
        const nextLocal = nextDate.toLocaleString();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        previewDiv.textContent = `${cron} → ${translation} (Next: ${nextUTC} UTC / ${nextLocal} ${tz})`;
    } catch (e) {
        previewDiv.textContent = `${cron} → ${translation}`;
    }
    previewDiv.style.color = 'var(--secondary-color)';
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return '—';
    const next = new Date(dateStr);
    const now = new Date();
    const diffMs = next - now;
    if (diffMs < 0) return 'Past';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffHrs < 1) return `in ${diffMins}m`;
    if (diffDays < 1) return `in ${diffHrs}h ${diffMins % 60}m`;
    return `in ${diffDays}d ${diffHrs % 24}h`;
}

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
                <td style="font-family: monospace; font-size: 0.85em;">${new Date(l.timestamp).toLocaleString()}</td>
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

function translateCron(cron) {
    const parts = cron.split(' ');
    if (parts.length !== 5) return 'Custom schedule';
    const [min, hour, dom, month, dow] = parts;
    if (min === '0' && hour === '0' && dom === '*' && month === '*' && dow === '*') return 'Daily at Midnight';
    if (min === '0' && hour === '12' && dom === '*' && month === '*' && dow === '*') return 'Daily at Noon';
    if (min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') return 'Hourly';
    if (min === '0' && hour === '0' && dom === '*' && month === '*' && dow === '1') return 'Weekly on Monday';
    if (min === '0' && hour === '*/6' && dom === '*' && month === '*' && dow === '*') return 'Every 6 hours';
    if (min === '0' && hour === '*' && dom === '*' && month === '*' && (dow === '0' || dow === '6' || dow === '0,6')) return 'Weekends';
    if (min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '1-5') return 'Weekdays';
    return 'Custom schedule';
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

window.addEventListener('popstate', handlePageLoad);
window.onload = handlePageLoad;

window.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'announcement-modal') closeModal();
        if (e.target.id === 'broadcast-preview-modal') closePreviewModal();
    }
});

document.addEventListener('click', e => {
    if (e.target.classList.contains('nav-item')) {
        e.preventDefault();
        const href = e.target.getAttribute('href');
        window.history.pushState({}, '', href);
        handlePageLoad();
    }
});
async function renderBroadcasts(container) {
    container.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0;">Manage Announcements</h3>
                    <p style="color: #888; margin: 5px 0 0 0;">Scheduled global broadcasts for Discord and Mattermost.</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-success" onclick="previewBroadcast()">👁️ Preview</button>
                    <button class="btn-primary" onclick="openAnnouncementModal()">➕ New</button>
                    <button class="btn-primary" onclick="triggerBroadcastNow()">🚀 Force Now</button>
                </div>
            </div>
            <div class="table-responsive">
                <table id="announcements-table">
                    <thead>
                        <tr>
                            <th>Text</th>
                            <th>Status</th>
                            <th>Targets</th>
                            <th>Schedule</th>
                            <th>Next Run</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const data = await api('/api/admin/announcements');
        const tbody = document.querySelector('#announcements-table tbody');
        tbody.innerHTML = data.map(a => `
            <tr>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${a.text}</td>
                <td class="col-toggle text-center" onclick="toggleAnnouncement(${a.id}, !${a.is_active})">
                    <label class="switch">
                        <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td>
                    <span class="col-toggle" style="cursor: pointer" onclick="toggleAnnouncementTarget(${a.id}, 'discord_enabled', !${a.discord_enabled})">
                        💬 ${a.discord_enabled ? '✅' : '❌'}
                    </span>
                    <span class="col-toggle" style="cursor: pointer" onclick="toggleAnnouncementTarget(${a.id}, 'mattermost_enabled', !${a.mattermost_enabled})">
                        🏢 ${a.mattermost_enabled ? '✅' : '❌'}
                    </span>
                    <span class="col-toggle" style="cursor: pointer" onclick="toggleAnnouncementTarget(${a.id}, 'twitch_enabled', !${a.twitch_enabled})">
                        🎮 ${a.twitch_enabled ? '✅' : '❌'}
                    </span>
                </td>
                <td style="font-family: monospace; font-size: 0.85em;">${a.cron_schedule || 'Manual'}</td>
                <td style="font-family: monospace; font-size: 0.85em; color: var(--secondary-color)">${a.next_run ? new Date(a.next_run).toLocaleString() : '—'}</td>
                <td>
                    <button class="btn-primary" onclick="openAnnouncementModal(${a.id})">Edit</button>
                    <button class="btn-danger" onclick="deleteAnnouncement(${a.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        notify('Error loading announcements: ' + e.message, 'error');
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
