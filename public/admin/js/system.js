async function renderSystem(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Database Portability</h3>
            <div style="display: flex; gap: 20px; align-items: center;">
                <button class="btn-primary" onclick="exportDb()">Export Database (JSON)</button>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="file" id="import-file">
                    <button class="btn-success" onclick="importDb()">Import Database</button>
                </div>
            </div>
        </div>
    `;
}

async function exportDb() {
    const res = await fetch(`${BASE_URL}/api/admin/db/export`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'twitchwatch_db_export.json';
    a.click();
}

async function importDb() {
    const fileInput = document.getElementById('import-file');
    if (!fileInput.files[0]) {
        notify('Please select a file', 'error');
        return;
    }
    try {
        const text = await fileInput.files[0].text();
        const json = JSON.parse(text);
        await api('/api/admin/db/import', 'POST', json);
        notify('Database imported successfully!');
    } catch (e) {
        notify('Import failed: ' + e.message, 'error');
    }
}
