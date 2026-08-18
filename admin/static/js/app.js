/* StarPayUz Admin Panel - Main Application */

// State
let state = {
    token: null,
    admin: null,
    currentPage: 'dashboard',
    ws: null,
};

// API Base
const API_BASE = window.location.origin;

// Initialize application
function initApp() {
    // Check for saved token
    const savedToken = localStorage.getItem('admin_token');
    const savedAdmin = localStorage.getItem('admin_info');
    
    if (savedToken && savedAdmin) {
        state.token = savedToken;
        state.admin = JSON.parse(savedAdmin);
        showPanel();
        navigateTo('dashboard');
    } else {
        document.getElementById('loginPage').style.display = 'flex';
    }
}

// Authentication
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');
    
    if (!username || !password) {
        showLoginError('Введите имя пользователя и пароль');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        
        const data = await res.json();
        
        if (res.ok) {
            state.token = data.access_token;
            state.admin = data.admin;
            localStorage.setItem('admin_token', data.access_token);
            localStorage.setItem('admin_info', JSON.stringify(data.admin));
            showPanel();
            navigateTo('dashboard');
        } else {
            showLoginError(data.detail || 'Ошибка входа');
        }
    } catch (err) {
        showLoginError('Ошибка соединения с сервером');
    }
}

function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.classList.add('visible');
}

function showPanel() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('adminName').textContent = state.admin.username;
    document.getElementById('adminRole').textContent = state.admin.role;
    document.getElementById('adminAvatar').textContent = state.admin.username[0].toUpperCase();
}

function handleLogout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    state.token = null;
    state.admin = null;
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginPassword').value = '';
}

// Navigation
function navigateTo(page) {
    state.currentPage = page;
    
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });
    
    // Load page content
    const content = document.getElementById('mainContent');
    content.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Загрузка...</div>';
    
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'users': loadUsers(); break;
        case 'balance': loadBalance(); break;
        case 'broadcasts': loadBroadcasts(); break;
        case 'orders': loadOrders(); break;
        case 'settings': loadSettings(); break;
        case 'logs': loadLogs(); break;
        default: loadDashboard();
    }
}

// API helper
async function apiRequest(method, path, body = null) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    
    if (res.status === 401) {
        handleLogout();
        return null;
    }
    
    if (!res.ok) {
        throw new Error(data.detail || 'API Error');
    }
    
    return data;
}

async function apiGet(path) { return apiRequest('GET', path); }
async function apiPost(path, body) { return apiRequest('POST', path, body); }
async function apiPut(path, body) { return apiRequest('PUT', path, body); }
async function apiDelete(path) { return apiRequest('DELETE', path); }

// Modal
function showModal(title, bodyHtml, confirmText = 'Подтвердить', confirmCallback = null) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('active');
    
    const confirmBtn = document.getElementById('modalConfirmBtn');
    if (confirmCallback) {
        confirmBtn.style.display = 'inline-flex';
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = confirmCallback;
    } else {
        confirmBtn.style.display = 'none';
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function modalConfirm() {
    // Overridden by showModal's confirmCallback
    closeModal();
}

// Utility functions
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num || 0);
}

function getStatusBadge(status) {
    const map = {
        'completed': '<span class="badge success">✅ Завершено</span>',
        'paid': '<span class="badge success">✅ Оплачено</span>',
        'pending': '<span class="badge warning">⏳ Ожидание</span>',
        'processing': '<span class="badge info">🔄 Обработка</span>',
        'failed': '<span class="badge danger">❌ Ошибка</span>',
        'cancelled': '<span class="badge secondary">🚫 Отменено</span>',
        'draft': '<span class="badge secondary">📄 Черновик</span>',
        'sending': '<span class="badge info">📤 Отправка</span>',
        'credit': '<span class="badge success">💰 Пополнение</span>',
        'debit': '<span class="badge danger">💸 Списание</span>',
        'reset': '<span class="badge warning">🔄 Сброс</span>',
        'set': '<span class="badge info">📝 Установка</span>',
        'login': '<span class="badge info">🔑 Вход</span>',
        'balance_change': '<span class="badge warning">💰 Баланс</span>',
        'broadcast_create': '<span class="badge info">📢 Создание</span>',
        'broadcast_send': '<span class="badge warning">📤 Отправка</span>',
        'broadcast_completed': '<span class="badge success">✅ Рассылка</span>',
        'settings_change': '<span class="badge info">⚙️ Настройки</span>',
        'settings_init': '<span class="badge success">⚙️ Инициализация</span>',
        'user_block': '<span class="badge danger">🚫 Блокировка</span>',
        'user_unblock': '<span class="badge success">✅ Разблокировка</span>',
        'user_delete': '<span class="badge danger">🗑 Удаление</span>',
    };
    return map[status] || `<span class="badge secondary">${status}</span>`;
}

// WebSocket connection
function connectWebSocket() {
    if (state.ws) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/admin/ws`;
    
    try {
        state.ws = new WebSocket(wsUrl);
        
        state.ws.onopen = () => {
            state.ws.send(JSON.stringify({ token: state.token }));
        };
        
        state.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'connected') {
                    console.log('WebSocket connected as admin', msg.admin_id);
                } else if (msg.type === 'ping') {
                    state.ws.send(JSON.stringify({ type: 'pong' }));
                } else if (msg.type === 'update') {
                    // Refresh current page on update
                    if (state.currentPage === 'dashboard') {
                        loadDashboard();
                    }
                }
            } catch (e) {}
        };
        
        state.ws.onclose = () => {
            state.ws = null;
            // Reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
        };
        
        state.ws.onerror = () => {
            state.ws = null;
        };
    } catch (e) {
        state.ws = null;
    }
}
