/**
 * Transactions monitoring view
 */

let state = {
    transactions: [],
    loading: true,
    page: 1,
    total: 0,
    filters: {
        status: '',
        provider: '',
        type: ''
    }
};

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

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function loadTransactions(ctx) {
    state.loading = true;
    render(ctx);

    try {
        const params = new URLSearchParams({
            page: state.page,
            per_page: 25,
            ...(state.filters.status ? { status: state.filters.status } : {}),
            ...(state.filters.provider ? { provider: state.filters.provider } : {}),
            ...(state.filters.type ? { type: state.filters.type } : {})
        });
        const res = await apiCall(ctx, `/transactions?${params}`);
        state.transactions = res.transactions || [];
        state.total = res.total || 0;
        state.loading = false;
    } catch (e) {
        state.loading = false;
        ctx.Toast.error('Erreur de chargement');
    }
    render(ctx);
}

function render(ctx) {
    const container = ctx.root.querySelector('#transactions-table-body');
    if (!container) return;

    if (state.loading) {
        container.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div></td></tr>';
        return;
    }

    if (state.transactions.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="empty-state">Aucune transaction trouvée</td></tr>';
        return;
    }

    container.innerHTML = state.transactions.map(tx => `
    <tr>
      <td><code style="font-size:11px">${escapeHTML(tx.external_ref || tx.id)}</code></td>
      <td>${formatDate(tx.created_at)}</td>
      <td>${escapeHTML(tx.user_phone || tx.user_id)}</td>
      <td>
        <span class="badge badge-info">${escapeHTML(tx.type || 'deposit')}</span>
      </td>
      <td>${tx.amount?.toLocaleString()} FCFA</td>
      <td>${escapeHTML(tx.provider || '-')}</td>
      <td>
        <span class="badge ${tx.status === 'completed' ? 'badge-success' :
            tx.status === 'pending' ? 'badge-warning' :
                tx.status === 'failed' ? 'badge-danger' : 'badge-info'
        }">${tx.status}</span>
      </td>
      <td>
        <button class="btn btn-xs btn-outline" data-view="${tx.id}">Détails</button>
      </td>
    </tr>
  `).join('');

    // View details
    container.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tx = state.transactions.find(t => t.id === parseInt(btn.dataset.view));
            if (tx) openTransactionDetails(ctx, tx);
        });
    });

    // Pagination info
    const paginationEl = ctx.root.querySelector('#pagination-info');
    if (paginationEl) {
        const start = (state.page - 1) * 25 + 1;
        const end = Math.min(state.page * 25, state.total);
        paginationEl.textContent = `${start}-${end} sur ${state.total}`;
    }
}

function openTransactionDetails(ctx, tx) {
    const content = document.createElement('div');
    content.innerHTML = `
    <div style="display:grid;gap:12px">
      <div><strong>Référence:</strong> ${escapeHTML(tx.external_ref)}</div>
      <div><strong>Date:</strong> ${formatDate(tx.created_at)}</div>
      <div><strong>Utilisateur:</strong> ${escapeHTML(tx.user_phone || tx.user_id)}</div>
      <div><strong>Montant:</strong> ${tx.amount?.toLocaleString()} FCFA</div>
      <div><strong>Provider:</strong> ${escapeHTML(tx.provider)}</div>
      <div><strong>Statut:</strong> <span class="badge ${tx.status === 'completed' ? 'badge-success' : tx.status === 'failed' ? 'badge-danger' : 'badge-warning'}">${tx.status}</span></div>
      ${tx.error_message ? `<div><strong>Erreur:</strong> <span style="color:red">${escapeHTML(tx.error_message)}</span></div>` : ''}
      ${tx.provider_data ? `
        <div style="margin-top:12px">
          <strong>Réponse Provider:</strong>
          <pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:12px;overflow-x:auto;margin-top:8px">${escapeHTML(JSON.stringify(tx.provider_data, null, 2))}</pre>
        </div>
      ` : ''}
    </div>
  `;

    ctx.Modal.open({
        title: `Transaction ${tx.external_ref}`,
        content,
        actions: [{ label: 'Fermer' }]
    });
}

const view = {
    render() {
        return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Monitoring des transactions</span>
          <div style="display:flex;gap:12px;align-items:center">
            <select class="input" id="filter-status" style="width:120px">
              <option value="">Tous statuts</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select class="input" id="filter-provider" style="width:120px">
              <option value="">Tous providers</option>
              <option value="monetbill">Monetbil</option>
              <option value="mtn_momo">MTN MoMo</option>
              <option value="orange_money">Orange Money</option>
            </select>
            <span id="pagination-info" style="font-size:13px;color:#64748b"></span>
          </div>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Provider</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="transactions-table-body">
                <tr><td colspan="8" class="loading"><div class="spinner"></div></td></tr>
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:center;gap:8px;margin-top:16px">
            <button class="btn btn-outline btn-sm" id="prev-btn" disabled>← Précédent</button>
            <button class="btn btn-outline btn-sm" id="next-btn">Suivant →</button>
          </div>
        </div>
      </div>
    `;
    },

    async mount(ctx) {
        const statusFilter = ctx.root.querySelector('#filter-status');
        const providerFilter = ctx.root.querySelector('#filter-provider');
        const prevBtn = ctx.root.querySelector('#prev-btn');
        const nextBtn = ctx.root.querySelector('#next-btn');

        // Filters
        statusFilter?.addEventListener('change', () => {
            state.filters.status = statusFilter.value;
            state.page = 1;
            loadTransactions(ctx);
        });

        providerFilter?.addEventListener('change', () => {
            state.filters.provider = providerFilter.value;
            state.page = 1;
            loadTransactions(ctx);
        });

        // Pagination
        prevBtn?.addEventListener('click', () => {
            if (state.page > 1) {
                state.page--;
                loadTransactions(ctx);
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (state.page * 25 < state.total) {
                state.page++;
                loadTransactions(ctx);
            }
        });

        await loadTransactions(ctx);
    }
};

export default view;
