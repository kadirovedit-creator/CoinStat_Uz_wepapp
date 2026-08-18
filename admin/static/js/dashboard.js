/* Dashboard Page */
let dashboardCharts = {};

async function loadDashboard() {
    const content = document.getElementById('mainContent');
    
    try {
        const data = await apiGet('/api/admin/dashboard/stats');
        
        content.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">📊 Dashboard</h1>
                    <p class="page-subtitle">Статистика системы StarPayUz</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="loadDashboard()">🔄 Обновить</button>
            </div>
            
            <div class="stats-grid" id="statsGrid">
                <div class="stat-card">
                    <div class="stat-icon blue">👥</div>
                    <div class="stat-info">
                        <div class="stat-label">Всего пользователей</div>
                        <div class="stat-value">${formatNumber(data.stats.total_users)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">✅</div>
                    <div class="stat-info">
                        <div class="stat-label">Активные пользователи</div>
                        <div class="stat-value">${formatNumber(data.stats.active_users)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon yellow">🆕</div>
                    <div class="stat-info">
                        <div class="stat-label">Новых за сегодня</div>
                        <div class="stat-value">${formatNumber(data.stats.new_users_today)}</div>
                        <div class="stat-change up">+${formatNumber(data.stats.new_users_week)} за неделю</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple">💰</div>
                    <div class="stat-info">
                        <div class="stat-label">Общий баланс</div>
                        <div class="stat-value">${formatNumber(data.stats.total_balance)} so'm</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">📦</div>
                    <div class="stat-info">
                        <div class="stat-label">Всего заказов</div>
                        <div class="stat-value">${formatNumber(data.stats.total_orders)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon cyan">💳</div>
                    <div class="stat-info">
                        <div class="stat-label">Общий доход</div>
                        <div class="stat-value">${formatNumber(data.stats.total_revenue)} so'm</div>
                    </div>
                </div>
            </div>
            
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">📈 Рост пользователей (30 дней)</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="userGrowthChart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">💵 Объём транзакций (30 дней)</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="transactionChart"></canvas>
                    </div>
                </div>
            </div>
        `;
        
        // Render charts
        setTimeout(() => {
            renderUserGrowthChart(data.user_growth);
            renderTransactionChart(data.transaction_volume);
        }, 100);
        
        // Connect WebSocket
        connectWebSocket();
        
    } catch (err) {
        content.innerHTML = `<div class="alert danger">❌ Ошибка загрузки: ${err.message}</div>`;
    }
}

function renderUserGrowthChart(data) {
    const ctx = document.getElementById('userGrowthChart');
    if (!ctx) return;
    
    if (dashboardCharts.userGrowth) {
        dashboardCharts.userGrowth.destroy();
    }
    
    dashboardCharts.userGrowth = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.date.slice(5)),
            datasets: [{
                label: 'Новые пользователи',
                data: data.map(d => d.value),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 10 } },
                },
                y: {
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#64748b', font: { size: 10 } },
                    beginAtZero: true,
                }
            }
        }
    });
}

function renderTransactionChart(data) {
    const ctx = document.getElementById('transactionChart');
    if (!ctx) return;
    
    if (dashboardCharts.transaction) {
        dashboardCharts.transaction.destroy();
    }
    
    dashboardCharts.transaction = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.slice(5)),
            datasets: [{
                label: 'Транзакции (so\'m)',
                data: data.map(d => d.value),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#22c55e',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 10 } },
                },
                y: {
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#64748b', font: { size: 10 } },
                    beginAtZero: true,
                }
            }
        }
    });
}
