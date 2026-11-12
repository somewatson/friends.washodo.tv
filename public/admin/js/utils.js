const API_KEY = '{{API_KEY}}';
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

function notify(message, type = 'success') {
    const toast = document.getElementById('notification-toast');
    toast.textContent = message;
    toast.className = type === 'success' ? 'toast-success' : 'toast-error';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
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
