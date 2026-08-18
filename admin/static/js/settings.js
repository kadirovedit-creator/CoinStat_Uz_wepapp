/* Settings Page */
async function loadSettings() {
    const content = document.getElementById('mainContent');
    
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">⚙️ Настройки</h1>
                <p class="page-subtitle">Управление настройками системы</p>
            </div>
            <button class="btn btn-outline btn-sm" onclick="initDefaultSettings()">📥 Инициализировать по умолчанию</button>
        </div>
        
        <div class="card" style="margin-bottom:20px;">
            <div class="card-header">
                <h3 class="card-title">🔐 Сменить пароль</h3>
            </div>
            <div class="card-body" style="padding:0 20px 20px;">
                <div class="form-group">
                    <label class="form-label">Текущий пароль</label>
                    <input type="password" class="form-input" id="currentPassword" placeholder="••••••" style="max-width:300px;">
                </div>
                <div class="form-group">
                    <label class="form-label">Новый пароль</label>
                    <input type="password" class="form-input" id="newPassword" placeholder="Минимум 6 символов" style="max-width:300px;">
                </div>
                <button class="btn btn-primary btn-sm" onclick="changeAdminPassword()">🔑 Сменить пароль</button>
                <div id="passwordChangeResult" style="margin-top:8px;"></div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">📋 Все настройки</h3>
            </div>
            <div class="table-container">
                <div id="settingsTableContent">
                    <div class="loading"><div class="loading-spinner"></div>Загрузка настроек...</div>
                </div>
            </div>
        </div>
    `;
    
    await fetchSettings();
}

async function changeAdminPassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const resultEl = document.getElementById('passwordChangeResult');
    
    if (!currentPassword || !newPassword) {
        resultEl.innerHTML = '<span style="color:var(--danger);">❌ Заполните оба поля</span>';
        return;
    }
    if (newPassword.length < 6) {
        resultEl.innerHTML = '<span style="color:var(--danger);">❌ Новый пароль должен быть минимум 6 символов</span>';
        return;
    }
    
    try {
        await apiPost('/api/admin/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword,
        });
        resultEl.innerHTML = '<span style="color:var(--success);">✅ Пароль успешно изменен!</span>';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
    } catch (err) {
        resultEl.innerHTML = `<span style="color:var(--danger);">❌ ${err.message}</span>`;
    }
}

async function fetchSettings() {
    const tableContent = document.getElementById('settingsTableContent');
    
    try {
        const data = await apiGet('/api/admin/settings');
        
        if (data.settings.length === 0) {
            tableContent.innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚙️</div>
                    <h3>Настройки не найдены</h3>
                    <p>Нажмите "Инициализировать по умолчанию"</p>
                </div>
            `;
            return;
        }
        
        // Group by category
        const categories = {};
        data.settings.forEach(s => {
            if (!categories[s.category]) categories[s.category] = [];
            categories[s.category].push(s);
        });
        
        let html = '';
        
        for (const [category, settings] of Object.entries(categories)) {
            const categoryNames = {
                'prices': '💰 Цены',
                'commissions': '💸 Комиссии',
                'limits': '📏 Лимиты',
                'general': '🔧 Общие',
            };
            
            html += `
                <div class="section">
                    <div class="section-title">${categoryNames[category] || category}</div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Ключ</th>
                                <th>Значение</th>
                                <th>Описание</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${settings.map(s => `
                                <tr>
                                    <td><code>${s.key}</code></td>
                                    <td><strong>${s.value}</strong></td>
                                    <td style="color:var(--text-muted);font-size:13px;">${s.description || '—'}</td>
                                    <td>
                                        <button class="btn btn-outline btn-sm" onclick="showEditSettingModal('${s.key}', '${s.value.replace(/'/g, "\\'")}')">✏️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        tableContent.innerHTML = html;
        
    } catch (err) {
        tableContent.innerHTML = `<div class="alert danger">❌ ${err.message}</div>`;
    }
}

function showEditSettingModal(key, currentValue) {
    showModal(`✏️ Редактировать: ${key}`, `
        <div class="form-group">
            <label class="form-label">Ключ</label>
            <div class="form-input" style="background:var(--bg-secondary);cursor:default;"><code>${key}</code></div>
        </div>
        <div class="form-group">
            <label class="form-label">Значение</label>
            <input type="text" class="form-input" id="settingValue" value="${currentValue}" required>
        </div>
    `, 'Сохранить', async () => {
        const value = document.getElementById('settingValue').value.trim();
        if (!value) { alert('Введите значение'); return; }
        
        try {
            await apiPut(`/api/admin/settings/${key}`, { key, value });
            alert('✅ Настройка сохранена');
            closeModal();
            fetchSettings();
        } catch (err) {
            alert('❌ ' + err.message);
        }
    });
}

async function initDefaultSettings() {
    if (!confirm('Инициализировать настройки по умолчанию?')) return;
    
    try {
        const data = await apiPost('/api/admin/settings/init', {});
        alert(`✅ Создано настроек: ${data.created}`);
        fetchSettings();
    } catch (err) {
        alert('❌ ' + err.message);
    }
}
