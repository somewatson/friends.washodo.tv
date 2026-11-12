async function renderStreamers(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Add New Streamer</h3>
            <div class="form-group">
                <div style="position: relative; flex: 2;">
                    <input type="text" id="streamer-user" placeholder="Twitch Username" style="width: 100%; box-sizing: border-box;">
                    <div id="search-results" style="position: absolute; top: 35px; left: 0; width: 100%; background: #2d2d2d; border: 1px solid #555; z-index: 10; display: none; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"></div>
                </div>
                <select id="streamer-cat" style="flex: 1;">
                    <option value="friend">Friend</option>
                    <option value="community">Community</option>
                    <option value="partner">Partner</option>
                </select>
                <button class="btn-primary" onclick="addStreamer()">Add Streamer</button>
            </div>
        </div>
        <div class="card">
            <h3>Tracked Streamers</h3>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Category</th>
                            <th>Notify</th>
                            <th>Show</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="streamers-table-body"></tbody>
                </table>
            </div>
        </div>
    `;

    const input = document.getElementById('streamer-user');
    input.addEventListener('input', (e) => handleUserSearch(e.target.value));

    try {
        const streamers = await api('/api/admin/streamers');
        const tbody = document.getElementById('streamers-table-body');
        tbody.innerHTML = streamers.map(s => `
            <tr>
                <td><strong>${s.username}</strong></td>
                <td>${s.category}</td>
                <td class="col-toggle text-center">
                    <label class="switch">
                        <input type="checkbox" ${s.notify_enabled ? 'checked' : ''} onchange="toggleStreamerNotify('${s.username}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="col-toggle text-center">
                    <label class="switch">
                        <input type="checkbox" ${s.show_on_page ? 'checked' : ''} onchange="toggleStreamerShow('${s.username}', this.checked)">
                        <span class="slider"></span>
                    </label>
                </td>
                <td>
                    <button class="btn-danger" onclick="removeStreamer('${s.username}')">Remove</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        notify('Error loading streamers: ' + e.message, 'error');
    }
}

let searchTimeout;
async function handleUserSearch(query) {
    const resultsDiv = document.getElementById('search-results');
    clearTimeout(searchTimeout);
    if (!query || query.length < 3) {
        resultsDiv.style.display = 'none';
        return;
    }
    searchTimeout = setTimeout(async () => {
        try {
            const users = await api(`/api/admin/twitch/search?q=${encodeURIComponent(query)}`);
            if (users.length === 0) {
                resultsDiv.innerHTML = '<div style="padding: 10px; color: #888;">No users found</div>';
            } else {
                resultsDiv.innerHTML = users.map(u => `
                    <div class="search-result-item" onclick="selectUser('${u.broadcaster_login}')">
                        <strong>${u.display_name}</strong> <small>@${u.broadcaster_login}</small>
                    </div>
                `).join('');
            }
            resultsDiv.style.display = 'block';
        } catch (e) {
            console.error('Search error:', e);
        }
    }, 300);
}

function selectUser(login) {
    document.getElementById('streamer-user').value = login;
    document.getElementById('search-results').style.display = 'none';
}

async function addStreamer() {
    const username = document.getElementById('streamer-user').value;
    const category = document.getElementById('streamer-cat').value;
    if (!username) return;
    try {
        await api('/api/admin/streamers', 'POST', { username, category });
        document.getElementById('streamer-user').value = '';
        renderStreamers(document.getElementById('content-area'));
        notify('Streamer added!');
    } catch (e) {
        notify('Failed to add streamer: ' + e.message, 'error');
    }
}

async function removeStreamer(username) {
    if (!confirm('Are you sure you want to remove ' + username + '? This action cannot be undone.')) return;
    try {
        await api('/api/admin/streamers/' + username, 'DELETE');
        renderStreamers(document.getElementById('content-area'));
        notify('Streamer removed!');
    } catch (e) {
        notify('Delete failed: ' + e.message, 'error');
    }
}

async function toggleStreamerNotify(username, enabled) {
    try {
        await api('/api/admin/streamers/toggle-notify', 'POST', { username, enabled });
        notify('Notification preference updated!');
        renderStreamers(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to update notification preference: ' + e.message, 'error');
    }
}

async function toggleStreamerShow(username, visible) {
    try {
        await api('/api/admin/streamers/toggle-show', 'POST', { username, visible });
        notify('Visibility preference updated!');
        renderStreamers(document.getElementById('content-area'));
    } catch (e) {
        notify('Failed to update visibility preference: ' + e.message, 'error');
    }
}
