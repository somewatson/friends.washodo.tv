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

async function addMattermost() {
    const config = {
        label: document.getElementById('mm-label').value,
        server_url: document.getElementById('mm-url').value,
        webhook_token: document.getElementById('mm-webhook').value,
        bot_token: document.getElementById('mm-bot').value,
        channel_id: document.getElementById('mm-channel').value
    };
    if (!config.server_url) return;
    await api('/api/admin/mattermost', 'POST', config);
    document.querySelectorAll('#panel-mattermost input').forEach(i => i.value = '');
    renderMattermost(document.getElementById('content-area'));
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
