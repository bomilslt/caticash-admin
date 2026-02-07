/**
 * Users management view
 */

let state = {
  users: [],
  loading: true,
  page: 1,
  total: 0,
  search: ''
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

async function loadUsers(ctx) {
  state.loading = true;
  render(ctx);

  try {
    const params = new URLSearchParams({
      page: state.page,
      per_page: 20,
      ...(state.search ? { search: state.search } : {})
    });
    const res = await apiCall(ctx, `/users?${params}`);
    state.users = res.users || [];
    state.total = res.total || 0;
    state.loading = false;
  } catch (e) {
    state.loading = false;
    ctx.Toast.error('Erreur de chargement');
  }
  render(ctx);
}

function render(ctx) {
  const container = ctx.root.querySelector('#users-table-body');
  if (!container) return;

  if (state.loading) {
    container.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div></td></tr>';
    return;
  }

  if (state.users.length === 0) {
    container.innerHTML = '<tr><td colspan="7" class="empty-state">Aucun utilisateur trouvé</td></tr>';
    return;
  }

  const getKycBadge = (status) => {
    const badges = {
      'none': '<span class="badge" style="background:#6b7280">Non soumis</span>',
      'pending': '<span class="badge badge-warning">En attente</span>',
      'approved': '<span class="badge badge-success">Validé</span>',
      'rejected': '<span class="badge badge-danger">Rejeté</span>'
    };
    return badges[status] || badges['none'];
  };

  container.innerHTML = state.users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><strong>${escapeHTML(u.first_name || '')} ${escapeHTML(u.last_name || '')}</strong></td>
      <td>${escapeHTML(u.phone || '-')}</td>
      <td>${escapeHTML(u.email || '-')}</td>
      <td>${u.vaults_count || 0}</td>
      <td>
        <span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">
          ${u.is_active ? 'Actif' : 'Bloqué'}
        </span>
        ${getKycBadge(u.kyc_status)}
      </td>
      <td>
        <button class="btn btn-xs btn-outline" data-view="${u.id}">Détails</button>
        <button class="btn btn-xs ${u.is_active ? 'btn-danger' : 'btn-primary'}" data-toggle="${u.id}">
          ${u.is_active ? 'Bloquer' : 'Activer'}
        </button>
      </td>
    </tr>
  `).join('');

  // View details
  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => openUserDetails(ctx, parseInt(btn.dataset.view)));
  });

  // Toggle status
  container.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await apiCall(ctx, `/users/${btn.dataset.toggle}/toggle`, { method: 'POST' });
        await loadUsers(ctx);
        ctx.Toast.success('Statut modifié');
      } catch (e) {
        ctx.Toast.error('Erreur');
      }
    });
  });

  // Pagination info
  const paginationEl = ctx.root.querySelector('#pagination-info');
  if (paginationEl) {
    const start = (state.page - 1) * 20 + 1;
    const end = Math.min(state.page * 20, state.total);
    paginationEl.textContent = `${start}-${end} sur ${state.total}`;
  }
}

async function openUserDetails(ctx, userId) {
  try {
    const user = await apiCall(ctx, `/users/${userId}`);

    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display:grid;gap:12px">
        <div><strong>Nom:</strong> ${escapeHTML(user.first_name || '')} ${escapeHTML(user.last_name || '')}</div>
        <div><strong>ID:</strong> ${user.id}</div>
        <div><strong>Téléphone:</strong> ${escapeHTML(user.phone || '-')}</div>
        <div><strong>Email:</strong> ${escapeHTML(user.email || '-')}</div>
        <div><strong>Inscrit le:</strong> ${new Date(user.created_at).toLocaleDateString('fr-FR')}</div>
        <div><strong>Nombre de coffres:</strong> ${user.vaults?.length || 0}</div>
        ${user.vaults?.length > 0 ? `
          <div style="margin-top:12px">
            <strong>Coffres:</strong>
            <table class="table" style="margin-top:8px">
              <thead><tr><th>Nom</th><th>Solde</th><th>Bloqué jusqu'au</th><th>Actions</th></tr></thead>
              <tbody>
                ${user.vaults.map(v => {
      const lockedUntil = v.locked_until ? new Date(v.locked_until) : null;
      const isLocked = lockedUntil && lockedUntil > new Date();
      return `
                  <tr>
                    <td>${escapeHTML(v.name)}</td>
                    <td>${v.balance.toLocaleString()} FCFA</td>
                    <td>
                      ${lockedUntil ? `
                        <span class="badge ${isLocked ? 'badge-warning' : 'badge-success'}">
                          ${lockedUntil.toLocaleDateString('fr-FR')}
                        </span>
                      ` : '-'}
                    </td>
                    <td>
                      ${isLocked ? `
                        <button class="btn btn-xs btn-outline" data-unblock="${v.id}">Débloquer</button>
                      ` : '<span class="badge badge-success">Débloqué</span>'}
                    </td>
                  </tr>
                `;
    }).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;

    // Attach unblock handlers
    content.querySelectorAll('[data-unblock]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Débloquer ce coffre ? L\'utilisateur pourra retirer ses fonds immédiatement.')) return;
        try {
          await apiCall(ctx, `/vaults/${btn.dataset.unblock}/unblock`, { method: 'POST' });
          ctx.Toast.success('Coffre débloqué');
          ctx.Modal.close();
          openUserDetails(ctx, userId); // Refresh
        } catch (e) {
          ctx.Toast.error(e.message_key || 'Erreur lors du déblocage');
        }
      });
    });

    ctx.Modal.open({
      title: `Utilisateur #${userId}`,
      content,
      actions: [{ label: 'Fermer' }]
    });
  } catch (e) {
    ctx.Toast.error('Erreur de chargement');
  }
}

const view = {
  render() {
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Gestion des utilisateurs</span>
          <div style="display:flex;gap:12px;align-items:center">
            <input type="text" class="input" id="search-input" placeholder="Rechercher..." style="width:200px">
            <span id="pagination-info" style="font-size:13px;color:#64748b"></span>
          </div>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Coffres</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                <tr><td colspan="6" class="loading"><div class="spinner"></div></td></tr>
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
    const searchInput = ctx.root.querySelector('#search-input');
    const prevBtn = ctx.root.querySelector('#prev-btn');
    const nextBtn = ctx.root.querySelector('#next-btn');

    // Search
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = e.target.value;
        state.page = 1;
        loadUsers(ctx);
      }, 300);
    });

    // Pagination
    prevBtn?.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        loadUsers(ctx);
      }
    });

    nextBtn?.addEventListener('click', () => {
      if (state.page * 20 < state.total) {
        state.page++;
        loadUsers(ctx);
      }
    });

    await loadUsers(ctx);
  }
};

export default view;
