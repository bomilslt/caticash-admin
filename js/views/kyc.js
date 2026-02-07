/**
 * KYC Validation view
 * Admin can view, approve, or reject KYC submissions
 */

let state = {
    requests: [],
    loading: true,
    filter: 'pending', // 'pending', 'approved', 'rejected', ''
    error: null
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

async function loadRequests(ctx) {
    state.loading = true;
    state.error = null;
    renderContent(ctx);

    try {
        const params = state.filter ? `?status=${state.filter}` : '';
        const result = await apiCall(ctx, `/kyc${params}`);
        state.requests = result.requests || [];
        state.loading = false;
    } catch (e) {
        state.error = e.message_key || 'Erreur de chargement';
        state.loading = false;
    }
    renderContent(ctx);
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge badge-warning">En attente</span>',
        'approved': '<span class="badge badge-success">Approuvé</span>',
        'rejected': '<span class="badge badge-danger">Rejeté</span>'
    };
    return badges[status] || status;
}

function renderContent(ctx) {
    const container = ctx.root.querySelector('#kyc-content');
    if (!container) return;

    if (state.loading) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        return;
    }

    if (state.error) {
        container.innerHTML = `
            <div class="empty-state">
                <p>${escapeHTML(state.error)}</p>
                <button class="btn btn-primary" id="retry-btn">Réessayer</button>
            </div>
        `;
        container.querySelector('#retry-btn')?.addEventListener('click', () => loadRequests(ctx));
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom:16px;display:flex;gap:8px;">
            <button class="btn btn-sm ${state.filter === 'pending' ? 'btn-primary' : 'btn-outline'}" data-filter="pending">En attente</button>
            <button class="btn btn-sm ${state.filter === 'approved' ? 'btn-primary' : 'btn-outline'}" data-filter="approved">Approuvés</button>
            <button class="btn btn-sm ${state.filter === 'rejected' ? 'btn-primary' : 'btn-outline'}" data-filter="rejected">Rejetés</button>
            <button class="btn btn-sm ${state.filter === '' ? 'btn-primary' : 'btn-outline'}" data-filter="">Tous</button>
        </div>

        ${state.requests.length === 0 ? `
            <div class="empty-state">Aucune demande KYC</div>
        ` : `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Contact</th>
                            <th>Soumis le</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.requests.map(req => `
                            <tr>
                                <td><strong>${escapeHTML(req.first_name)} ${escapeHTML(req.last_name)}</strong></td>
                                <td>${escapeHTML(req.phone)}<br><small>${escapeHTML(req.email)}</small></td>
                                <td>${req.kyc_submitted_at ? new Date(req.kyc_submitted_at).toLocaleDateString('fr-FR') : '-'}</td>
                                <td>${getStatusBadge(req.kyc_status)}</td>
                                <td>
                                    <button class="btn btn-xs btn-outline" data-view="${req.id}">Voir</button>
                                    ${req.kyc_status === 'pending' ? `
                                        <button class="btn btn-xs btn-primary" data-approve="${req.id}">Approuver</button>
                                        <button class="btn btn-xs btn-danger" data-reject="${req.id}">Rejeter</button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `}
    `;

    // Filter buttons
    container.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.filter = btn.dataset.filter;
            loadRequests(ctx);
        });
    });

    // View details
    container.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => openDetailsModal(ctx, parseInt(btn.dataset.view)));
    });

    // Approve
    container.querySelectorAll('[data-approve]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Approuver ce KYC ?')) return;
            await reviewKyc(ctx, parseInt(btn.dataset.approve), 'approve');
        });
    });

    // Reject
    container.querySelectorAll('[data-reject]').forEach(btn => {
        btn.addEventListener('click', () => openRejectModal(ctx, parseInt(btn.dataset.reject)));
    });
}

function openDetailsModal(ctx, userId) {
    const req = state.requests.find(r => r.id === userId);
    if (!req) return;

    // Helper to build image URL from relative path
    const getImageUrl = (path) => {
        if (!path) return null;
        return `${ctx.getApiBase().replace('/api/admin', '/api/v1')}/uploads/${path}`;
    };

    const renderImage = (label, path) => {
        const url = getImageUrl(path);
        return `
            <div style="margin-bottom:16px">
                <strong>${label}:</strong><br>
                ${url
                ? `<img src="${escapeHTML(url)}" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:8px;border:1px solid var(--color-border)">`
                : '<em style="color:var(--color-muted)">Non fournie</em>'}
            </div>
        `;
    };

    const content = document.createElement('div');
    content.innerHTML = `
        <div style="display:grid;gap:12px">
            <div>
                <strong>Client:</strong> ${escapeHTML(req.first_name)} ${escapeHTML(req.last_name)}
            </div>
            <div>
                <strong>Contact:</strong> ${escapeHTML(req.phone)} / ${escapeHTML(req.email)}
            </div>
            <div>
                <strong>Statut:</strong> ${getStatusBadge(req.kyc_status)}
                ${req.kyc_rejection_reason ? `<br><small style="color:var(--color-danger)">${escapeHTML(req.kyc_rejection_reason)}</small>` : ''}
            </div>
            <div>
                <strong>N° Pièce:</strong> ${escapeHTML(req.kyc_id_number || '-')}
            </div>
            <hr style="border:none;border-top:1px solid var(--color-border);margin:8px 0">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
                ${renderImage('Pièce Recto', req.kyc_id_front)}
                ${renderImage('Pièce Verso', req.kyc_id_back)}
                ${renderImage('Selfie', req.kyc_selfie)}
                ${renderImage('Photo + Pièce', req.kyc_photo_with_id)}
            </div>
        </div>
    `;

    ctx.Modal.open({
        title: `KYC - ${req.first_name} ${req.last_name}`,
        content,
        actions: [{ label: 'Fermer' }]
    });
}

function openRejectModal(ctx, userId) {
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="field">
            <label class="label">Raison du rejet</label>
            <textarea class="input" id="reject-reason" rows="3" placeholder="Ex: Document illisible, photo floue..."></textarea>
        </div>
    `;

    ctx.Modal.open({
        title: 'Rejeter le KYC',
        content,
        actions: [
            { label: 'Annuler' },
            {
                label: 'Rejeter',
                variant: 'danger',
                closeOnClick: false,
                onClick: async () => {
                    const reason = content.querySelector('#reject-reason').value.trim();
                    await reviewKyc(ctx, userId, 'reject', reason);
                    ctx.Modal.close();
                }
            }
        ]
    });
}

async function reviewKyc(ctx, userId, action, reason = '') {
    try {
        await apiCall(ctx, `/kyc/${userId}/review`, {
            method: 'POST',
            body: JSON.stringify({ action, reason })
        });
        ctx.Toast.success(action === 'approve' ? 'KYC Approuvé' : 'KYC Rejeté');
        await loadRequests(ctx);
    } catch (e) {
        ctx.Toast.error(e.message_key || 'Erreur');
    }
}

const view = {
    render() {
        return `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Validation KYC</div>
                </div>
                <div class="card-body" id="kyc-content">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    },

    async mount(ctx) {
        await loadRequests(ctx);
    }
};

export default view;
