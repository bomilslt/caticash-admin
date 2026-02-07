/**
 * Dashboard view with stats and charts
 */

let charts = {};

async function apiCall(ctx, path, options = {}) {
    const session = ctx.getSession();
    const res = await fetch(`${ctx.getApiBase()}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
            ...(options.headers || {})
        }
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

const view = {
    render() {
        return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <div class="stat-value" id="stat-users">-</div>
          <div class="stat-label">Utilisateurs</div>
        </div>
        <div class="stat-card" data-color="green">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div class="stat-value" id="stat-vaults">-</div>
          <div class="stat-label">Coffres actifs</div>
        </div>
        <div class="stat-card" data-color="purple">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div class="stat-value" id="stat-volume">-</div>
          <div class="stat-label">Volume (7j)</div>
        </div>
        <div class="stat-card" data-color="orange">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <div class="stat-value" id="stat-transactions">-</div>
          <div class="stat-label">Transactions (24h)</div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-container">
          <div class="chart-title">Inscriptions (30 derniers jours)</div>
          <canvas id="chart-registrations"></canvas>
        </div>
        <div class="chart-container">
          <div class="chart-title">Répartition des paiements</div>
          <canvas id="chart-providers"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Dernières transactions</span>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="table" id="recent-transactions">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="5" class="loading"><div class="spinner"></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    },

    async mount(ctx) {
        // Load stats
        try {
            const stats = await apiCall(ctx, '/stats');

            document.getElementById('stat-users').textContent = formatNumber(stats.total_users || 0);
            document.getElementById('stat-vaults').textContent = formatNumber(stats.active_vaults || 0);
            document.getElementById('stat-volume').textContent = formatNumber(stats.volume_7d || 0) + ' FCFA';
            document.getElementById('stat-transactions').textContent = formatNumber(stats.transactions_24h || 0);

            // Registrations chart
            if (stats.registrations_daily && window.Chart) {
                const regCtx = document.getElementById('chart-registrations')?.getContext('2d');
                if (regCtx) {
                    charts.registrations = new Chart(regCtx, {
                        type: 'line',
                        data: {
                            labels: stats.registrations_daily.map(d => d.date),
                            datasets: [{
                                label: 'Inscriptions',
                                data: stats.registrations_daily.map(d => d.count),
                                borderColor: '#2563eb',
                                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true }
                            }
                        }
                    });
                }
            }

            // Providers pie chart
            if (stats.payments_by_provider && window.Chart) {
                const provCtx = document.getElementById('chart-providers')?.getContext('2d');
                if (provCtx) {
                    charts.providers = new Chart(provCtx, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(stats.payments_by_provider),
                            datasets: [{
                                data: Object.values(stats.payments_by_provider),
                                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ef4444']
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: { position: 'bottom' }
                            }
                        }
                    });
                }
            }

            // Recent transactions
            if (stats.recent_transactions) {
                const tbody = document.querySelector('#recent-transactions tbody');
                if (stats.recent_transactions.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Aucune transaction récente</td></tr>';
                } else {
                    tbody.innerHTML = stats.recent_transactions.map(tx => `
            <tr>
              <td>${new Date(tx.created_at).toLocaleDateString('fr-FR')}</td>
              <td>${tx.user_phone || tx.user_id}</td>
              <td>${tx.type}</td>
              <td>${formatNumber(tx.amount)} FCFA</td>
              <td><span class="badge badge-${tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}">${tx.status}</span></td>
            </tr>
          `).join('');
                }
            }

        } catch (err) {
            console.error('Failed to load dashboard stats:', err);
            ctx.Toast.error('Erreur lors du chargement des statistiques');
        }
    },

    unmount() {
        Object.values(charts).forEach(c => c?.destroy?.());
        charts = {};
    }
};

export default view;
