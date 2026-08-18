/* Logs Page */
let logsPage = 1;
let logsActionFilter = '';

async function loadLogs() {
    const content = document.getElementById('mainContent');
    logsPage = 1;
    
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">📋 Логи действий</h1>
                <p class="page-subtitle">Журнал действий администраторов</p>
            </div>
        </div>
        
        <div class="toolbar">
            <button class="btn btn-outline btn-sm ${!logsActionFilter ? 'btn-primary' : ''}" onclick="filterLogs('')">📋 Все</button>
            <button class="btn btn-outline btn-sm ${logsActionFilter === 'login' ? 'btn-primary' : ''}" onclick="filterLogs('login')">🔑 Входы</button>
            <button class="btn btn-outline btn-sm ${logsActionFilter === 'balance_change' ? 'btn-primary' : ''}" onclick="filterLogs('balance_change')">💰 Баланс</button>
            <button class="btn btn-outline btn-sm ${logsActionFilter === 'broadcast' ? 'btn-primary' : ''}" onclick="filterLogs('broadcast')">📢 Рассылки</button>
            <button class="btn btn-outline btn-sm ${logsActionFilter === 'settings_change' ? 'btn-primary' : ''}" onclick="filterLogs('settings_change')">⚙️ Настройки</button>
            <button class="btn btn-outline btn-sm ${logsActionFilter === 'user' ? 'btn-primary' : ''}" onclick="filterLogs('user')">👤 Пользователи</button>
        </div>
        
        <div class="card">
            <div class="table-container">
                <div id="logsTableContent">
                    <div class="loading"><div class="loading-spinner"></div>Загрузка логов...</div>
                </div>
            </div>
            <div id="logsPagination" class="pagination"></div>
        </div>
    `;
    
    await fetchLogs();
}

function filterLogs(action) {
    logsActionFilter = action;
    logsPage = 1;
    
    // Update button styles
    document.querySelectorAll('.toolbar .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });
    if (event && event.target) {
        event.target.classList.remove('btn-outline');
        event.target.classList.add('btn-primary');
    }
    
    fetchLogs();
}

async function fetchLogs() {
    const tableContent = document.getElementById('logsTableContent');
    const pagination = document.getElementById('logsPagination');
    
    try {
        let url = `/api/admin/logs?page=${logsPage}&page_size=50`;
        if (logsActionFilter) {
            const filterMap = {
                'login': 'login',
                'balance_change': 'balance_change',
                'broadcast': 'broadcast',
                'settings_change': 'settings_change',
                'user': 'user',
            };
            const actionFilter = filterMap[logsActionFilter];
            if (actionFilter) {
                url += `&action=${actionFilter}`;
            }
        }
        
        const data = await apiGet(url);
        
        if (data.logs.length === 0) {
            tableContent.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>Логов не найдено</h3>
                    <p>Действия администраторов будут отображаться здесь</p>
                </div>
            `;
            pagination.innerHTML = '';
            return;
        }
        
        tableContent.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Время</th>
                        <th>Администратор</th>
                        <th>Действие</th>
                        <th>Объект</th>
                        <th>Детали</th>
                        <th>IP адрес</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.logs.map(log => `
                        <tr>
                            <td style="white-space:nowrap;">${formatDate(log.created_at)}</td>
                            <td><strong>${log.admin_username}</strong></td>
                            <td>${getStatusBadge(log.action)}</td>
                            <td>${log.entity_type || '—'} ${log.entity_id ? `#${log.entity_id}` : ''}</td>
                            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${log.details || ''}">${log.details || '—'}</td>
                            <td><code>${log.ip_address || '—'}</code></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        // Pagination
        const totalPages = Math.ceil(data.total / 50);
        if (totalPages > 1) {
            let phtml = '';
            phtml += `<button class="page-btn" onclick="logsPage=${logsPage-1};fetchLogs()" ${logsPage <= 1 ? 'disabled' : ''}>‹</button>`;
            phtml += `<span class="page-info">Стр. ${logsPage} из ${totalPages}</span>`;
            phtml += `<button class="page-btn" onclick="logsPage=${logsPage+1};fetchLogs()" ${logsPage >= totalPages ? 'disabled' : ''}>›</button>`;
            pagination.innerHTML = phtml;
        } else {
            pagination.innerHTML = '';
        }
        
    } catch (err) {
        tableContent.innerHTML = `<div class="alert danger">❌ ${err.message}</div>`;
    }
}
