async function renderBroadcasts(container) {
    try {
        const timeData = await api('/api/admin/system/time');
        const serverTimeStr = new Date(timeData.serverTime).toUTCString();
        const timezoneStr = timeData.timezone;

        container.innerHTML = `
            <div class="card">
                <h3 style="margin-top:0">Broadcasts</h3>
                <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <small style="color: #aaa;">Manual trigger for all active announcements.</small>
                        <small style="color: var(--secondary-color); font-weight: bold;">Server Time (UTC): ${serverTimeStr} (${timezoneStr})</small>
                        <small style="color: #aaa;">Your Local Time: ${new Date().toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})</small>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-primary" onclick="previewBroadcast()">👁️ Preview Targets</button>
                        <button class="btn-success" onclick="triggerBroadcastNow()">🚀 Send All Active Now</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin:0">Announcements</h3>
                    <button class="btn-primary" onclick="openAnnouncementModal()">+ Add Announcement</button>
                </div>
                <div class="table-responsive">
                    <table id="announcements-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Text Preview</th>
                                <th>Active</th>
                                <th>Discord</th>
                                <th>MM</th>
                                <th>Twitch</th>
                                <th>Next Run</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        const data = await api('/api/admin/announcements');
        const tbody = document.querySelector('#announcements-table tbody');
        tbody.innerHTML = data.map(a => `
            <tr class="draggable-row" data-id="${a.id}">
                <td>${a.order_index}</td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${a.text}</td>
                <td class="col-toggle text-center" onclick="toggleAnnouncement(${a.id}, !${a.is_active})">
                    <label class="switch">
                        <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="col-toggle text-center" onclick="toggleAnnouncementTarget(${a.id}, 'discord_enabled', !${a.discord_enabled})">
                    <label class="switch">
                        <input type="checkbox" ${a.discord_enabled ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="col-toggle text-center" onclick="toggleAnnouncementTarget(${a.id}, 'mattermost_enabled', !${a.mattermost_enabled})">
                    <label class="switch">
                        <input type="checkbox" ${a.mattermost_enabled ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="col-toggle text-center" onclick="toggleAnnouncementTarget(${a.id}, 'twitch_enabled', !${a.twitch_enabled})">
                    <label class="switch">
                        <input type="checkbox" ${a.twitch_enabled ? 'checked' : ''} onchange="event.stopPropagation()">
                        <span class="slider"></span>
                    </label>
                </td>
                <td style="font-size: 0.85em; color: #aaa; white-space: nowrap;">
                    ${a.next_run ? `${new Date(a.next_run).toLocaleString()} (${formatRelativeTime(a.next_run)})` : '—'}
                </td>
                <td>
                    <button class="btn-primary" onclick="openAnnouncementModal(${a.id})">Edit</button>
                    <button class="btn-danger" onclick="deleteAnnouncement(${a.id})">Delete</button>
                </td>
            </tr>
        `).join('');
        
        new Sortable(tbody, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function() {
                const rows = Array.from(tbody.querySelectorAll('.draggable-row'));
                const order = rows.map((row, index) => ({
                    id: parseInt(row.getAttribute('data-id')),
                    orderIndex: index
                }));
                try {
                    await api('/api/admin/announcements/reorder', 'POST', { order });
                    notify('Order saved successfully!');
                    loadDataBotSettings();
                } catch (e) {
                    notify('Failed to save order: ' + e.message, 'error');
                }
            }
        });
    } catch (e) {
        notify('Error loading broadcasts: ' + e.message, 'error');
    }
}

async function loadDataBotSettings() {
    const container = document.getElementById('content-area');
    await renderBroadcasts(container);
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
                        <span class="target-id">${t.channelId}</span>
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
    if (!cronInput || !previewDiv) return;
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
