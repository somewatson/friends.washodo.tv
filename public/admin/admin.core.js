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

    if (!document.documentElement.dataset.theme) {
        document.documentElement.dataset.theme = 'agency';
    }

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    let loadPromise;
    
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
    } else if (path === '/warden/discord-logs') {
        document.getElementById('nav-discord-logs').classList.add('active');
        titleEl.textContent = 'Discord Interaction Logs';
        descEl.textContent = 'Review messages and commands received by the Discord bot.';
        loadPromise = renderDiscordLogs(contentArea);
    } else {
        window.location.href = '/warden/streamers';
        return;
    }
    
    await (loadPromise || Promise.resolve());
    document.body.dataset.loaded = 'true';
}

function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    notify(`Theme switched to ${theme}`);
}
