async function renderLeads(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Captured Leads</h3>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Plan</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="leads-table-body"></tbody>
                </table>
            </div>
        </div>
    `;
    try {
        const leads = await api('/api/admin/leads');
        const tbody = document.getElementById('leads-table-body');
        tbody.innerHTML = leads.map(l => `
            <tr>
                <td>${new Date(l.created_at).toLocaleDateString()}</td>
                <td><strong>${l.full_name}</strong></td>
                <td>${l.email}</td>
                <td><span class="status-pill" style="background: #444">${l.selected_plan}</span></td>
                <td>${l.status}</td>
            </tr>
        `).join('');
    } catch (e) {
        notify('Error loading leads: ' + e.message, 'error');
    }
}
