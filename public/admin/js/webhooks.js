async function renderWebhooks(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Configure Internal Webhooks</h3>
            <p style="color: #aaa; margin-bottom: 20px;">Map system events to external URLs for real-time notifications.</p>
            <div class="form-group">
                <select id="webhook-event">
                    <option value="user.signup">User Signup (user.signup)</option>
                    <option value="system.alert">System Alert (system.alert)</option>
                    <option value="broadcast.sent">Broadcast Sent (broadcast.sent)</option>
                </select>
                <input type="text" id="webhook-url" placeholder="Target URL (Webhook endpoint)">
                <button class="btn-primary" onclick="addWebhook()">Add Webhook</button>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>URL</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="webhooks-table-body"></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const hooks = await api('/api/admin/webhooks');
        const tbody = document.getElementById('webhooks-table-body');
        tbody.innerHTML = hooks.map(h => `
            <tr>
                <td><code>${h.event_type}</code></td>
                <td style="font-family: monospace; font-size: 0.85rem;">${h.target_url}</td>
                <td class="col-toggle text-center">
                    <label class="switch">
                        <input type="checkbox" ${h.is_active ? 'checked' : ''} onchange="toggleWebhook(${h.id}, this.checked)">
                        <span class="slider"></span>
                    </label>
                </td>
                <td>
                    <button class="btn-danger" onclick="removeWebhook(${h.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        notify('Error loading webhooks: ' + e.message, 'error');
    }
}

async function addWebhook() {
    const event_type = document.getElementById('webhook-event').value;
    const target_url = document.getElementById('webhook-url').value;
    if (!target_url) return notify('URL is required', 'error');
    try {
        await api('/api/admin/webhooks', 'POST', { event_type, target_url });
        notify('Webhook added!');
        renderWebhooks(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed: ' + e.message, 'error');
    }
}

async function toggleWebhook(id, active) {
    try {
        await api('/api/admin/webhooks/toggle', 'POST', { id, active });
        notify('Webhook status updated!');
    } catch (e) {
        notify('Update failed: ' + e.message, 'error');
    }
}

async function removeWebhook(id) {
    if (!confirm('Remove this webhook?')) return;
    try {
        await api('/api/admin/webhooks/' + id, 'DELETE');
        notify('Webhook removed!');
        renderWebhooks(document.getElementById('content-area'));
    } catch (e) {
        notify('Delete failed: ' + e.message, 'error');
    }
}
