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
                    <tbody id="streamers-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const data = await api('/api/admin/streamers');
        const tbody = document.getElementById('streamers-tbody');
        if (!tbody) return;
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <div class="icon">👥</div>
                            <h3>No Streamers Tracked</h3>
                            <p>Start by adding community members or friends to track their live status.</p>
                            <button class="btn-action" onclick="document.getElementById('streamer-user').focus()">Add First Streamer</button>
                        </div>
                    </td>
                </tr>`;
            return;
        }
        tbody.innerHTML = data.map(s => `
            <tr class="draggable-row" data-username="${s.username}">
                <td><a href="${s.profileUrl}" target="_blank" style="color: white; text-decoration: none; font-weight: bold; display: flex; align-items: center;">
                    ${s.profileImage ? `<img src="${s.profileImage}" class="guild-icon" alt="">` : `<div class="guild-icon" style="display:inline-block"></div>`}
                    ${s.username} ↗
                </a></td>
                <td><span class="status-pill pill-category" style="--pill-color: var(--vibe-${s.category === 'streamer' ? 'partner' : s.category})">${s.category}</span></td>
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
                <td>
                    <button class="btn-success" onclick="forceNotify('${s.username}')" title="Force Notify Live">⚡</button>
                    <button class="btn-danger" onclick="removeStreamer('${s.username}')">Remove</button>
                </td>
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

async function forceNotify(username) {
    if (!confirm(`Force a live notification for ${username}?`)) return;
    try {
        await api('/api/admin/streamers/force-notify', 'POST', { username });
        notify(`Force notification sent for ${username}!`);
    } catch (e) {
        notify('Force notify failed: ' + e.message, 'error');
    }
}

async function addStreamer() {
    const username = document.getElementById('streamer-user').value;
    const category = document.getElementById('streamer-cat').value;
    if (!username) return notify('Username is required', 'error');
    try {
        await api('/api/admin/streamers', 'POST', { username, category });
        notify('Streamer added/updated!');
        renderStreamers(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to add streamer: ' + e.message, 'error');
    }
}

async function removeStreamer(username) {
    if (!confirm(`Remove ${username} from tracked list?`)) return;
    try {
        await api(`/api/admin/streamers/${username}`, 'DELETE');
        notify('Streamer removed!');
        renderStreamers(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to remove streamer: ' + e.message, 'error');
    }
}

async function toggleStreamerNotify(username, enabled) {
    try {
        await api('/api/admin/streamers/toggle-notify', 'POST', { username, enabled });
        notify('Notification setting updated!');
    } catch (e) {
        notify('Failed to update notification: ' + e.message, 'error');
    }
}

async function toggleStreamerShow(username, visible) {
    try {
        await api('/api/admin/streamers/toggle-show', 'POST', { username, visible });
        notify('Visibility setting updated!');
    } catch (e) {
        notify('Failed to update visibility: ' + e.message, 'error');
    }
}

async function handleUserSearch(query) {
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;
    if (query.length < 3) {
        resultsDiv.style.display = 'none';
        return;
    }
    try {
        const results = await api(`/api/admin/twitch/search?q=${encodeURIComponent(query)}`);
        if (results.length === 0) {
            resultsDiv.innerHTML = '<div style="padding: 10px; color: #888;">No users found</div>';
        } else {
            resultsDiv.innerHTML = results.map(u => `
                <div class="search-item" onclick="selectUser('${u.broadcaster_login || u.username}')" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #444; display: flex; align-items: center; gap: 10px;">
                    ${u.profile_image_url ? `<img src="${u.profile_image_url}" style="width: 24px; height: 24px; border-radius: 50%;">` : ''}
                    <span>${u.display_name || u.username}</span>
                </div>
            `).join('');
        }
        resultsDiv.style.display = 'block';
    } catch (e) {
        console.error('Search failed:', e);
    }
}

function selectUser(username) {
    document.getElementById('streamer-user').value = username;
    document.getElementById('search-results').style.display = 'none';
}
