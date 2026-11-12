async function renderDiscord(container) {
    container.innerHTML = `
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

async function addDiscord() {
    const body = {
        guild_id: document.getElementById('discord-guild').value,
        channel_id: document.getElementById('discord-channel').value,
        bot_token: document.getElementById('discord-token').value,
        owner_id: document.getElementById('discord-owner').value
    };
    if (!body.guild_id || !body.channel_id || !body.bot_token) {
        notify('Guild ID, Channel ID and Bot Token are required', 'error');
        return;
    }
    await api('/api/admin/discord/manual', 'POST', body);
    document.querySelectorAll('#panel-discord input').forEach(i => i.value = '');
    renderDiscord(document.getElementById('content-area'));
    notify('Discord integration added successfully!');
}

async function syncDiscord(guildId) {
    if (!confirm('Are you sure you want to sync the Discord server?')) return;
    try {
        await api(`/api/admin/discord/sync-channel/${guildId}`, 'POST');
        notify('Discord server synced successfully!');
        renderDiscord(document.getElementById('content-area'));
    } catch (e) {
        notify('Discord sync failed: ' + e.message, 'error');
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

async function testDiscord(guildId) {
    try {
        await api(`/api/admin/discord/test/${guildId}`, 'POST');
        notify('Test message sent to Discord!');
    } catch (e) {
        notify('Discord test failed: ' + e.message, 'error');
    }
}

async function removeDiscord(guildId) {
    if (!confirm('Are you sure you want to remove guild ' + guildId + '?')) return;
    await api('/api/admin/discord/' + guildId, 'DELETE');
    renderDiscord(document.getElementById('content-area'));
}
