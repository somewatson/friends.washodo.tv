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
                    <tbody id="announcements-tbody"></tbody>
                </table>
            </div>
            <div id="broadcasts-mobile-list" class="mobile-streamers-list" style="display: none;"></div>
        </div>
    `;
    try {
        const data = await api('/api/admin/announcements');
        const tbody = document.getElementById('announcements-tbody');
        if (!tbody) return;
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <div class="icon">📢</div>
                            <h3>No Announcements Scheduled</h3>
                            <p>Create your first broadcast to notify the community about events or updates.</p>
                            <button class="btn-action" onclick="openAnnouncementModal()">Create First Announcement</button>
                        </div>
                    </td>
                </tr>`;
            return;
        }
        tbody.innerHTML = data.map(a => `
            <tr>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${a.text}</td>
                <td class="col-toggle text-center">
                    <label class="switch">
                        <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="toggleAnnouncement(${a.id}, this.checked)">
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

        // Render mobile cards
        const mobileList = document.getElementById('broadcasts-mobile-list');
        if (mobileList) {
            mobileList.innerHTML = data.map(a => `
                <div class="streamer-card">
                    <div class="card-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="guild-icon-placeholder">📢</div>
                            <div style="display: flex; flex-direction: column;">
                                <strong style="color: white;">Announcement</strong>
                                <span style="font-size: 0.8em; color: #888;">${a.cron_schedule || 'Manual'}</span>
                            </div>
                        </div>
                        <span class="status-pill pill-category" style="--pill-color: ${a.is_active ? 'var(--success-color)' : 'var(--danger-color)'}">${a.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="card-body">
                        <div style="margin-bottom: 12px; font-size: 0.9rem; color: #ccc;">${a.text}</div>
                        <div class="card-toggle-row">
                            <label class="toggle-item">
                                <span class="toggle-label">Status</span>
                                <label class="switch">
                                    <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="toggleAnnouncement(${a.id}, this.checked)">
                                    <span class="slider"></span>
                                </label>
                            </label>
                            <label class="toggle-item">
                                <span class="toggle-label">Next Run</span>
                                <span style="font-size: 0.85em; color: #ccc;">${a.next_run ? new Date(a.next_run).toLocaleDateString() : '—'}</span>
                            </label>
                        </div>
                        <div class="card-actions">
                            <button class="btn-primary" onclick="openAnnouncementModal(${a.id})">Edit</button>
                            <button class="btn-danger" onclick="deleteAnnouncement(${a.id})">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        notify('Error loading announcements: ' + e.message, 'error');
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
        const nextLocal = nextDate ? nextDate.toLocaleString() : 'N/A';
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        previewDiv.textContent = `${cron} → ${translation} (Next: ${nextUTC} UTC / ${nextLocal} ${tz})`;
    } catch (e) {
        previewDiv.textContent = `${cron} → ${translation}`;
    }
    previewDiv.style.color = 'var(--secondary-color)';
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
