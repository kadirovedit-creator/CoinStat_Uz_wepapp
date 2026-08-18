/* Orders Page */
let ordersPage = 1;
let ordersStatusFilter = '';
let ordersTypeFilter = '';

async function loadOrders() {
    const content = document.getElementById('mainContent');
    ordersPage = 1;
    
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">📦 Заказы</h1>
                <p class="page-subtitle">Управление заказами пользователей</p>
            </div>
        </div>
        
        <div class="toolbar">
            <button class="btn btn-outline btn-sm ${!ordersStatusFilter ? 'btn-primary' : ''}" onclick="filterOrders('status', '')">📋 Все</button>
            <button class="btn btn-outline btn-sm ${ordersStatusFilter === 'pending' ? 'btn-primary' : ''}" onclick="filterOrders('status', 'pending')">⏳ Ожидание</button>
            <button class="btn btn-outline btn-sm ${ordersStatusFilter === 'processing' ? 'btn-primary' : ''}" onclick="filterOrders('status', 'processing')">🔄 В обработке</button>
            <button class="btn btn-outline btn-sm ${ordersStatusFilter === 'completed' ? 'btn-primary' : ''}" onclick="filterOrders('status', 'completed')">✅ Выполнено</button>
            <button class="btn btn-outline btn-sm ${ordersStatusFilter === 'failed' ? 'btn-primary' : ''}" onclick="filterOrders('status', 'failed')">❌ Ошибка</button>
            <button class="btn btn-outline btn-sm ${ordersStatusFilter === 'cancelled' ? 'btn-primary' : ''}" onclick="filterOrders('status', 'cancelled')">🚫 Отменено</button>
        </div>
        
        <div class="card">
            <div class="table-container">
                <div id="ordersTableContent">
                    <div class="loading"><div class="loading-spinner"></div>Загрузка заказов...</div>
                </div>
            </div>
            <div id="ordersPagination" class="pagination"></div>
        </div>
    `;
    
    await fetchOrders();
}

function filterOrders(type, value) {
    if (type === 'status') {
        ordersStatusFilter = value;
    } else if (type === 'product') {
        ordersTypeFilter = value;
    }
    ordersPage = 1;
    
    // Update all filter button styles
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        toolbar.querySelectorAll('.btn').forEach(btn => {
            const btnText = btn.textContent.trim();
            const isActive = (
                (btnText.includes('Все') && !value) ||
                (btnText.includes('Ожидание') && value === 'pending') ||
                (btnText.includes('Обработка') && value === 'processing') ||
                (btnText.includes('Выполнено') && value === 'completed') ||
                (btnText.includes('Ошибка') && value === 'failed') ||
                (btnText.includes('Отменено') && value === 'cancelled')
            );
            if (isActive) {
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-outline');
            } else {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            }
        });
    }
    
    fetchOrders();
}

async function fetchOrders() {
    const tableContent = document.getElementById('ordersTableContent');
    const pagination = document.getElementById('ordersPagination');
    
    try {
        let url = `/api/admin/orders?page=${ordersPage}&page_size=20`;
        if (ordersStatusFilter) url += `&status=${ordersStatusFilter}`;
        if (ordersTypeFilter) url += `&product_type=${ordersTypeFilter}`;
        
        const data = await apiGet(url);
        
        if (data.orders.length === 0) {
            tableContent.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>Заказы не найдены</h3>
                    <p>Измените параметры фильтрации</p>
                </div>
            `;
            pagination.innerHTML = '';
            return;
        }
        
        const productNames = {
            'stars': '⭐ Stars', 'premium': '💎 Premium',
            'topup': '💰 Пополнение', 'phone': '📱 Телефон',
            'gift': '🎁 Gift',
        };
        
        tableContent.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Тип</th>
                        <th>Пользователь</th>
                        <th>Получатель</th>
                        <th>Кол-во</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.orders.map(o => `
                        <tr>
                            <td>#${o.id}</td>
                            <td>${productNames[o.product_type] || o.product_type}</td>
                            <td><code>${o.telegram_id}</code></td>
                            <td>${o.target_username ? '@' + o.target_username : '—'}</td>
                            <td>${o.quantity || '—'}</td>
                            <td>${o.amount ? formatNumber(o.amount) + ' so\'m' : '—'}</td>
                            <td>${getStatusBadge(o.status)}</td>
                            <td style="white-space:nowrap;">${formatDate(o.created_at)}</td>
                            <td>
                                <button class="btn btn-outline btn-sm" onclick="showOrderInfo(${o.id})">👁</button>
                                <button class="btn btn-danger btn-sm" onclick="confirmDeleteOrder(${o.id})">🗑</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        const totalPages = Math.ceil(data.total / 20);
        renderOrdersPagination(pagination, ordersPage, totalPages);
        
    } catch (err) {
        tableContent.innerHTML = `<div class="alert danger">❌ ${err.message}</div>`;
        pagination.innerHTML = '';
    }
}

async function showOrderInfo(orderId) {
    try {
        const o = await apiGet(`/api/admin/orders/${orderId}`);
        const productNames = {
            'stars': '⭐ Stars', 'premium': '💎 Premium',
            'topup': '💰 Пополнение', 'phone': '📱 Телефон', 'gift': '🎁 Gift',
        };
        
        showModal(`📦 Заказ #${o.id}`, `
            <div class="form-group">
                <label class="form-label">Тип</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${productNames[o.product_type] || o.product_type}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Telegram ID</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;"><code>${o.telegram_id}</code></div>
            </div>
            <div class="form-group">
                <label class="form-label">Получатель</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${o.target_username ? '@' + o.target_username : '—'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Количество</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${o.quantity || '—'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Сумма</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${o.amount ? formatNumber(o.amount) + ' so\'m' : '—'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Статус</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${getStatusBadge(o.status)}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Дата</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${formatDate(o.created_at)}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Внешний ID</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${o.external_id || '—'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Изменить статус</label>
                <select class="form-select" id="orderNewStatus">
                    <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>⏳ Ожидание</option>
                    <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>🔄 Обработка</option>
                    <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>✅ Выполнено</option>
                    <option value="failed" ${o.status === 'failed' ? 'selected' : ''}>❌ Ошибка</option>
                    <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>🚫 Отменено</option>
                </select>
            </div>
        `, 'Изменить статус', async () => {
            const newStatus = document.getElementById('orderNewStatus').value;
            try {
                await apiPut(`/api/admin/orders/${orderId}/status`, { status: newStatus });
                alert('✅ Статус заказа обновлен');
                closeModal();
                fetchOrders();
            } catch (err) {
                alert('❌ ' + err.message);
            }
        });
        
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

function confirmDeleteOrder(orderId) {
    if (confirm(`Удалить заказ #${orderId}?`)) {
        apiDelete(`/api/admin/orders/${orderId}`)
            .then(() => { alert('✅ Заказ удален'); fetchOrders(); })
            .catch(err => alert('❌ ' + err.message));
    }
}

function renderOrdersPagination(container, current, total) {
    if (total <= 1) { container.innerHTML = ''; return; }
    let html = '';
    html += `<button class="page-btn" onclick="ordersPage=${current-1};fetchOrders()" ${current <= 1 ? 'disabled' : ''}>‹</button>`;
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    if (start > 1) {
        html += `<button class="page-btn" onclick="ordersPage=1;fetchOrders()">1</button>`;
        if (start > 2) html += `<span class="page-info">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="ordersPage=${i};fetchOrders()">${i}</button>`;
    }
    if (end < total) {
        if (end < total - 1) html += `<span class="page-info">...</span>`;
        html += `<button class="page-btn" onclick="ordersPage=${total};fetchOrders()">${total}</button>`;
    }
    html += `<button class="page-btn" onclick="ordersPage=${current+1};fetchOrders()" ${current >= total ? 'disabled' : ''}>›</button>`;
    container.innerHTML = html;
}
