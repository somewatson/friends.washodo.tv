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
                    <tbody id="discord-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const data = await api('/api/admin/discord');
        const tbody = document.getElementById('discord-tbody');
        if (!tbody) return;
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <div class="icon">💬</div>
                            <h3>No Discord Integrations</h3>
                            <p>Connect your Discord servers to start sending automated live notifications.</p>
                            <button class="btn-action" onclick="document.getElementById('discord-guild').focus()">Add First Server</button>
                        </div>
                    </td>
                </tr>`;
            return;
        }
        tbody.innerHTML = data.map(d => `
            <tr>
                <td>
                    ${d.serverIcon ? `<img src="${d.serverIcon}" class="guild-icon" alt="">` : `<div class="guild-icon" style="display:inline-block"></div>`}
                    <strong>${d.serverName || d.guildName || 'Unknown Server'}</strong><br><small style="color: #888">${d.guild_id}</small>
                </td>
                <td>${d.channel_id}</td>
                <td class="text-center">${d.memberCount ? d.memberCount.toLocaleString() : '0'}</td>
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
            const retryAt = status.rateLimitUntil ? new Date(status.rateLimitUntil) : new Date();
            const now = new Date();
            const diffMs = retryAt - now;
            const diffMins = Math.ceil(diffMs / 1000 / 60);
            
            statusHtml = `🔴 <span style="color: var(--danger-color)">Rate Limited</span><br>`;
            statusHtml += `<small>Last Ping: ${status.lastPing ? new Date(status.lastPing).toLocaleString() : 'Unknown'}</small><br>`;
            statusHtml += `<small>Retry after: ${status.retryAfter ? status.retryAfter + 's' : 'Unknown'}</small><br>`;
            statusHtml += `<small>Retry at: ${retryAt ? retryAt.toLocaleString() : 'Unknown'} (in ${diffMins}m)</small>`;
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

        if (status.bots && status.bots.length > 0) {
            statusHtml += `
                <div style="margin-top: 12px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid #444; font-size: 0.85em; line-height: 1.6;">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #eee; border-bottom: 1px solid #444; padding-bottom: 4px;">Connected Bots</div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${status.bots.map(bot => `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${bot.avatar ? `<img src="${bot.avatar}" style="width: 24px; height: 24px; border-radius: 50%;" alt="">` : '<div style="width: 24px; height: 24px; background: #555; border-radius: 50%;"></div>'}
                                <span><strong>${bot.tag}</strong> <small style="color: #888;">(${bot.id})</small> <span class="status-pill pill-${bot.status || 'offline'}" style="font-size: 0.7em; padding: 1px 4px; margin-left: 4px;">${bot.status || 'offline'}</span></span>
                            </div>
                        `).join('')}
                    </div>
                    ${status.sessionStatus ? `
                        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #444; font-weight: bold; color: #ccc;">
                            Session Mode: <span style="color: ${status.sessionStatus === 'Cached' ? 'var(--success-color)' : 'var(--accent-color)'}">${status.sessionStatus}</span>
                        </div>
                    ` : ''}
                </div>`;
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

async function syncDiscord(guildId) {
    try {
        await api(`/api/admin/discord/sync-channel/${guildId}`, 'POST');
        notify('Discord channel synced successfully!');
        renderDiscord(document.getElementById('content-area'));
    } catch (e) {
        notify('Discord sync failed: ' + e.message, 'error');
    }
}

async function addDiscord() {
    const body = {
        guild_id: document.getElementById('discord-guild').value,
        channel_id: document.getElementById('discord-channel').value,
        bot_token: document.getElementById('discord-token').value,
        owner_id: document.getElementById('discord-owner').value
    };
    if (!body.guild_id || !body.channel_id || !body.bot_token) {
        return notify('Guild ID, Channel ID, and Bot Token are required', 'error');
    }
    try {
        await api('/api/admin/discord/manual', 'POST', body);
        notify('Discord integration added!');
        renderDiscord(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to add Discord integration: ' + e.message, 'error');
    }
}

async function removeDiscord(guildId) {
    if (!confirm('Remove this Discord integration?')) return;
    try {
        await api(`/api/admin/discord/${guildId}`, 'DELETE');
        notify('Discord integration removed!');
        renderDiscord(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to remove Discord integration: ' + e.message, 'error');
    }
}

async function toggleDiscord(guildId, active) {
    try {
        await api('/api/admin/discord/toggle', 'POST', { guildId, active });
        notify('Discord integration status updated!');
    } catch (e) {
        notify('Failed to update Discord status: ' + e.message, 'error');
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
                    <tbody id="mm-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const data = await api('/api/admin/mattermost');
        const tbody = document.getElementById('mm-tbody');
        if (!tbody) return;
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="icon">🏢</div>
                            <h3>No Mattermost Configs</h3>
                            <p>Connect your Mattermost servers to start sending formatted community updates.</p>
                            <button class="btn-action" onclick="document.getElementById('mm-label').focus()">Add First Server</button>
                        </div>
                    </td>
                </tr>`;
            return;
        }
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

async function addMattermost() {
    const body = {
        label: document.getElementById('mm-label').value,
        server_url: document.getElementById('mm-url').value,
        webhook_token: document.getElementById('mm-webhook').value,
        bot_token: document.getElementById('mm-bot').value,
        channel_id: document.getElementById('mm-channel').value
    };
    if (!body.server_url || !body.webhook_token || !body.channel_id) {
        return notify('Server URL, Webhook Token, and Channel ID are required', 'error');
    }
    try {
        await api('/api/admin/mattermost', 'POST', body);
        notify('Mattermost config added!');
        renderMattermost(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to add Mattermost config: ' + e.message, 'error');
    }
}
