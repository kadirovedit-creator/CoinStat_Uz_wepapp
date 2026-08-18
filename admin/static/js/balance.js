/* Balance Management Page */
let balancePage = 1;

async function loadBalance() {
    const content = document.getElementById('mainContent');
    balancePage = 1;
    
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">💰 Управление балансом</h1>
                <p class="page-subtitle">Начисление, списание и просмотр истории операций</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-success btn-sm" onclick="showAddBalanceModal()">➕ Начислить</button>
                <button class="btn btn-danger btn-sm" onclick="showDeductBalanceModal()">➖ Списать</button>
                <button class="btn btn-warning btn-sm" onclick="showSetBalanceModal()">📝 Установить</button>
                <button class="btn btn-outline btn-sm" onclick="showResetBalanceModal()">🔄 Обнулить</button>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">📋 История операций</h3>
            </div>
            <div class="table-container">
                <div id="balanceTableContent">
                    <div class="loading"><div class="loading-spinner"></div>Загрузка истории...</div>
                </div>
            </div>
            <div id="balancePagination" class="pagination"></div>
        </div>
    `;
    
    await fetchBalanceHistory();
}

async function fetchBalanceHistory() {
    const tableContent = document.getElementById('balanceTableContent');
    const pagination = document.getElementById('balancePagination');
    
    try {
        const data = await apiGet(`/api/admin/balance/history?page=${balancePage}&page_size=50`);
        
        if (data.transactions.length === 0) {
            tableContent.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>История операций пуста</h3>
                    <p>Здесь будут отображаться все изменения баланса</p>
                </div>
            `;
            pagination.innerHTML = '';
            return;
        }
        
        tableContent.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Telegram ID</th>
                        <th>Тип</th>
                        <th>Сумма</th>
                        <th>Баланс до</th>
                        <th>Баланс после</th>
                        <th>Причина</th>
                        <th>Админ</th>
                        <th>Дата</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.transactions.map(t => `
                        <tr>
                            <td>#${t.id}</td>
                            <td><code>${t.telegram_id}</code></td>
                            <td>${getStatusBadge(t.type)}</td>
                            <td><strong>${formatNumber(t.amount)}</strong> so'm</td>
                            <td>${formatNumber(t.balance_before)}</td>
                            <td>${formatNumber(t.balance_after)}</td>
                            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${t.reason || '—'}</td>
                            <td>${t.admin_id || '—'}</td>
                            <td>${formatDate(t.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        // Pagination
        const totalPages = Math.ceil(data.total / 50);
        renderPagination(pagination, balancePage, totalPages, fetchBalanceHistory);
        
    } catch (err) {
        tableContent.innerHTML = `<div class="alert danger">❌ ${err.message}</div>`;
    }
}

function showAddBalanceModal() {
    showModal('➕ Начислить баланс', `
        <div class="form-group">
            <label class="form-label">Telegram ID пользователя</label>
            <input type="number" class="form-input" id="balanceUserId" placeholder="123456789" required>
        </div>
        <div class="form-group">
            <label class="form-label">Сумма (so'm)</label>
            <input type="number" class="form-input" id="balanceAmount" placeholder="50000" min="1" required>
        </div>
        <div class="form-group">
            <label class="form-label">Причина</label>
            <textarea class="form-textarea" id="balanceReason" placeholder="Например: бонус за активность"></textarea>
        </div>
    `, 'Начислить', async () => {
        const userId = parseInt(document.getElementById('balanceUserId').value);
        const amount = parseInt(document.getElementById('balanceAmount').value);
        const reason = document.getElementById('balanceReason').value;
        
        if (!userId || !amount) { alert('Заполните все поля'); return; }
        
        try {
            await apiPost('/api/admin/balance/add', { telegram_id: userId, amount, reason });
            alert('✅ Баланс успешно начислен');
            closeModal();
            fetchBalanceHistory();
        } catch (err) {
            alert('❌ ' + err.message);
        }
    });
}

function showDeductBalanceModal() {
    showModal('➖ Списать баланс', `
        <div class="form-group">
            <label class="form-label">Telegram ID пользователя</label>
            <input type="number" class="form-input" id="balanceUserId" placeholder="123456789" required>
        </div>
        <div class="form-group">
            <label class="form-label">Сумма (so'm)</label>
            <input type="number" class="form-input" id="balanceAmount" placeholder="10000" min="1" required>
        </div>
        <div class="form-group">
            <label class="form-label">Причина</label>
            <textarea class="form-textarea" id="balanceReason" placeholder="Например: возврат средств"></textarea>
        </div>
    `, 'Списать', async () => {
        const userId = parseInt(document.getElementById('balanceUserId').value);
        const amount = parseInt(document.getElementById('balanceAmount').value);
        const reason = document.getElementById('balanceReason').value;
        
        if (!userId || !amount) { alert('Заполните все поля'); return; }
        
        try {
            await apiPost('/api/admin/balance/deduct', { telegram_id: userId, amount, reason });
            alert('✅ Баланс успешно списан');
            closeModal();
            fetchBalanceHistory();
        } catch (err) {
            alert('❌ ' + err.message);
        }
    });
}

function showSetBalanceModal() {
    showModal('📝 Установить баланс', `
        <div class="form-group">
            <label class="form-label">Telegram ID пользователя</label>
            <input type="number" class="form-input" id="balanceUserId" placeholder="123456789" required>
        </div>
        <div class="form-group">
            <label class="form-label">Новый баланс (so'm)</label>
            <input type="number" class="form-input" id="balanceAmount" placeholder="0" min="0" required>
        </div>
        <div class="form-group">
            <label class="form-label">Причина</label>
            <textarea class="form-textarea" id="balanceReason" placeholder="Например: исправление ошибки"></textarea>
        </div>
    `, 'Установить', async () => {
        const userId = parseInt(document.getElementById('balanceUserId').value);
        const amount = parseInt(document.getElementById('balanceAmount').value);
        const reason = document.getElementById('balanceReason').value;
        
        if (!userId || amount === undefined) { alert('Заполните все поля'); return; }
        
        try {
            await apiPost('/api/admin/balance/set', { telegram_id: userId, amount, reason });
            alert('✅ Баланс успешно установлен');
            closeModal();
            fetchBalanceHistory();
        } catch (err) {
            alert('❌ ' + err.message);
        }
    });
}

function showResetBalanceModal() {
    showModal('🔄 Обнулить баланс', `
        <div class="form-group">
            <label class="form-label">Telegram ID пользователя</label>
            <input type="number" class="form-input" id="balanceUserId" placeholder="123456789" required>
        </div>
        <div class="form-group">
            <label class="form-label">Причина</label>
            <textarea class="form-textarea" id="balanceReason" placeholder="Например: сброс тестового баланса"></textarea>
        </div>
        <div class="alert warning">⚠️ Баланс пользователя будет сброшен до 0. Это действие нельзя отменить.</div>
    `, 'Обнулить', async () => {
        const userId = parseInt(document.getElementById('balanceUserId').value);
        const reason = document.getElementById('balanceReason').value;
        
        if (!userId) { alert('Введите Telegram ID'); return; }
        if (!confirm('Вы уверены, что хотите обнулить баланс пользователя ' + userId + '?')) return;
        
        try {
            await apiPost('/api/admin/balance/reset', { telegram_id: userId, reason });
            alert('✅ Баланс успешно обнулен');
            closeModal();
            fetchBalanceHistory();
        } catch (err) {
            alert('❌ ' + err.message);
        }
    });
}

// Override renderPagination for balance
function renderPagination(container, current, total, callback) {
    if (total <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    html += `<button class="page-btn" onclick="balancePage=${current-1};fetchBalanceHistory()" ${current <= 1 ? 'disabled' : ''}>‹</button>`;
    
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    
    if (start > 1) {
        html += `<button class="page-btn" onclick="balancePage=1;fetchBalanceHistory()">1</button>`;
        if (start > 2) html += `<span class="page-info">...</span>`;
    }
    
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="balancePage=${i};fetchBalanceHistory()">${i}</button>`;
    }
    
    if (end < total) {
        if (end < total - 1) html += `<span class="page-info">...</span>`;
        html += `<button class="page-btn" onclick="balancePage=${total};fetchBalanceHistory()">${total}</button>`;
    }
    
    html += `<button class="page-btn" onclick="balancePage=${current+1};fetchBalanceHistory()" ${current >= total ? 'disabled' : ''}>›</button>`;
    
    container.innerHTML = html;
}
