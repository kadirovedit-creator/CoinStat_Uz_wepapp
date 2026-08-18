/* Broadcasts Page */
async function loadBroadcasts() {
    const content = document.getElementById('mainContent');
    
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">📢 Рассылка сообщений</h1>
                <p class="page-subtitle">Отправка сообщений пользователям</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showCreateBroadcastModal()">✏️ Создать рассылку</button>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">📋 История рассылок</h3>
            </div>
            <div class="table-container">
                <div id="broadcastsTableContent">
                    <div class="loading"><div class="loading-spinner"></div>Загрузка...</div>
                </div>
            </div>
        </div>
    `;
    
    await fetchBroadcasts();
}

async function fetchBroadcasts() {
    const tableContent = document.getElementById('broadcastsTableContent');
    
    try {
        const data = await apiGet('/api/admin/broadcasts?page_size=50');
        
        if (data.broadcasts.length === 0) {
            tableContent.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>Рассылок пока нет</h3>
                    <p>Создайте первую рассылку</p>
                </div>
            `;
            return;
        }
        
        tableContent.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th>Отправлено</th>
                        <th>Всего</th>
                        <th>Ошибок</th>
                        <th>Контент</th>
                        <th>Дата</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.broadcasts.map(b => `
                        <tr>
                            <td>#${b.id}</td>
                            <td>${b.message_type === 'text' ? '📝 Текст' : b.message_type === 'photo' ? '🖼 Фото' : b.message_type === 'video' ? '🎬 Видео' : b.message_type === 'document' ? '📄 Документ' : '📝 Текст'}</td>
                            <td>${getStatusBadge(b.status)}</td>
                            <td>${b.sent_count}</td>
                            <td>${b.total_count}</td>
                            <td>${b.error_count}</td>
                            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.content || '—'}</td>
                            <td>${formatDate(b.created_at)}</td>
                            <td>
                                ${b.status === 'draft' ? `<button class="btn btn-success btn-sm" onclick="confirmSendBroadcast(${b.id})">📤 Отправить</button>` : ''}
                                ${b.status === 'sending' ? `<span class="badge info">⏳ Отправляется...</span>` : ''}
                                <button class="btn btn-outline btn-sm" onclick="showBroadcastInfo(${b.id})">👁</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
    } catch (err) {
        tableContent.innerHTML = `<div class="alert danger">❌ ${err.message}</div>`;
    }
}

function showCreateBroadcastModal() {
    showModal('✏️ Создать рассылку', `
        <div class="form-group">
            <label class="form-label">Тип сообщения</label>
            <select class="form-select" id="broadcastType" onchange="toggleBroadcastFields()">
                <option value="text">📝 Текст</option>
                <option value="photo">🖼 Фото</option>
                <option value="video">🎬 Видео</option>
                <option value="document">📄 Документ</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Текст сообщения</label>
            <textarea class="form-textarea" id="broadcastContent" placeholder="Введите текст сообщения..." rows="4"></textarea>
        </div>
        <div class="form-group" id="fileUrlGroup" style="display:none;">
            <label class="form-label">URL файла (или file_id из Telegram)</label>
            <input type="text" class="form-input" id="broadcastFileUrl" placeholder="https://example.com/image.jpg">
        </div>
        <div class="form-group">
            <label class="form-label">Кнопки (JSON, опционально)</label>
            <textarea class="form-textarea" id="broadcastButtons" placeholder='[{"text":"Открыть","url":"https://t.me/..."}]' rows="2"></textarea>
            <div class="form-help">Формат: [{"text":"Название","url":"https://..."}, {"text":"Кнопка2","callback_data":"data"}]</div>
        </div>
        <div class="form-group">
            <label class="form-label">Фильтры (JSON, опционально)</label>
            <textarea class="form-textarea" id="broadcastFilters" placeholder='{"language":"uz"}' rows="2"></textarea>
            <div class="form-help">Оставьте пустым для отправки всем пользователям</div>
        </div>
    `, 'Создать', async () => {
        const messageType = document.getElementById('broadcastType').value;
        const content = document.getElementById('broadcastContent').value;
        const fileUrl = document.getElementById('broadcastFileUrl').value;
        const buttons = document.getElementById('broadcastButtons').value || null;
        const filters = document.getElementById('broadcastFilters').value || null;
        
        if (!content && messageType === 'text') { alert('Введите текст сообщения'); return; }
        
        try {
            await apiPost('/api/admin/broadcasts', {
                message_type: messageType,
                content: content || null,
                file_url: fileUrl || null,
                buttons: buttons,
                filters: filters,
            });
            alert('✅ Рассылка создана');
            closeModal();
            fetchBroadcasts();
        } catch (err) {
            alert('❌ ' + err.message);
        }
    });
}

function toggleBroadcastFields() {
    const type = document.getElementById('broadcastType').value;
    document.getElementById('fileUrlGroup').style.display = 
        (type === 'photo' || type === 'video' || type === 'document') ? 'block' : 'none';
}

function confirmSendBroadcast(broadcastId) {
    if (!confirm('Отправить эту рассылку всем пользователям?')) return;
    
    apiPost(`/api/admin/broadcasts/${broadcastId}/send`, {})
        .then(data => {
            alert(`✅ Рассылка #${broadcastId} запущена! Всего получателей: ${data.total_count}`);
            fetchBroadcasts();
        })
        .catch(err => alert('❌ ' + err.message));
}

async function showBroadcastInfo(broadcastId) {
    try {
        const b = await apiGet(`/api/admin/broadcasts/${broadcastId}`);
        
        showModal(`📢 Рассылка #${b.id}`, `
            <div class="form-group">
                <label class="form-label">Тип</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${b.message_type}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Статус</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${getStatusBadge(b.status)}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Контент</label>
                <textarea class="form-textarea" style="background:var(--bg-secondary);cursor:default;" readonly rows="4">${b.content || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Статистика</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">
                    ✅ Отправлено: ${b.sent_count} | 📊 Всего: ${b.total_count} | ❌ Ошибок: ${b.error_count}
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Дата создания</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${formatDate(b.created_at)}</div>
            </div>
            ${b.completed_at ? `
            <div class="form-group">
                <label class="form-label">Завершена</label>
                <div class="form-input" style="background:var(--bg-secondary);cursor:default;">${formatDate(b.completed_at)}</div>
            </div>` : ''}
        `, '', null);
        
        document.getElementById('modalFooter').innerHTML = `
            <button class="btn btn-outline" onclick="closeModal()">Закрыть</button>
        `;
        
    } catch (err) {
        alert('❌ ' + err.message);
    }
}
