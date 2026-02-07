/**
 * Admins management view
 * Super admin can create/delete admins, regular admins can only view
 */

let state = {
    admins: [],
    isSuperAdmin: false,
    loading: true,
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

async function loadData(ctx) {
    state.loading = true;
    state.error = null;
    renderContent(ctx);

    try {
        const result = await apiCall(ctx, '/admins');
        state.admins = result.admins || [];
        state.isSuperAdmin = result.is_super_admin || false;
        state.loading = false;
    } catch (e) {
        state.error = e.message_key || 'Erreur de chargement';
        state.loading = false;
    }
    renderContent(ctx);
}

function renderContent(ctx) {
    const container = ctx.root.querySelector('#admins-content');
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
        container.querySelector('#retry-btn')?.addEventListener('click', () => loadData(ctx));
        return;
    }

    container.innerHTML = `
        <div class="section-header">
            <h3>Administrateurs (${state.admins.length})</h3>
            ${state.isSuperAdmin ? `
                <button class="btn btn-primary btn-sm" id="add-admin-btn">+ Nouvel Admin</button>
            ` : ''}
        </div>
        ${state.admins.length === 0 ? `
            <div class="empty-state">Aucun administrateur</div>
        ` : `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Téléphone</th>
                            <th>Email</th>
                            <th>Rôle</th>
                            ${state.isSuperAdmin ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${state.admins.map(admin => `
                            <tr>
                                <td><strong>${escapeHTML(admin.first_name)} ${escapeHTML(admin.last_name)}</strong></td>
                                <td>${escapeHTML(admin.phone)}</td>
                                <td>${escapeHTML(admin.email)}</td>
                                <td>
                                    <span class="badge ${admin.is_super_admin ? 'badge-warning' : 'badge-info'}">
                                        ${admin.is_super_admin ? 'Super Admin' : 'Admin'}
                                    </span>
                                </td>
                                ${state.isSuperAdmin ? `
                                    <td>
                                        ${admin.is_super_admin ? `
                                            <span class="badge badge-success">Vous</span>
                                        ` : `
                                            <button class="btn btn-sm btn-danger" data-delete="${admin.id}">Supprimer</button>
                                        `}
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `}
        ${!state.isSuperAdmin ? `
            <p style="margin-top: 16px; color: var(--color-text-muted); font-size: 13px;">
                Seul le super admin peut créer ou supprimer des administrateurs.
            </p>
        ` : ''}
    `;

    // Add admin button
    container.querySelector('#add-admin-btn')?.addEventListener('click', () => openAddModal(ctx));

    // Delete buttons
    container.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Supprimer cet administrateur ?')) return;
            try {
                await apiCall(ctx, `/admins/${btn.dataset.delete}`, { method: 'DELETE' });
                ctx.Toast.success('Administrateur supprimé');
                await loadData(ctx);
            } catch (e) {
                ctx.Toast.error(e.message_key || 'Erreur lors de la suppression');
            }
        });
    });
}

function openAddModal(ctx) {
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="field">
            <label class="label">Prénom *</label>
            <input type="text" class="input" id="admin-firstname" placeholder="Jean" required>
        </div>
        <div class="field">
            <label class="label">Nom *</label>
            <input type="text" class="input" id="admin-lastname" placeholder="Dupont" required>
        </div>
        <div class="field">
            <label class="label">Téléphone *</label>
            <input type="tel" class="input" id="admin-phone" placeholder="237..." required>
        </div>
        <div class="field">
            <label class="label">Email *</label>
            <input type="email" class="input" id="admin-email" placeholder="admin@example.com" required>
        </div>
        <div class="field">
            <label class="label">Mot de passe *</label>
            <input type="password" class="input" id="admin-password" placeholder="••••••••" required>
        </div>
    `;

    ctx.Modal.open({
        title: 'Nouvel Administrateur',
        content,
        actions: [
            { label: 'Annuler' },
            {
                label: 'Créer',
                variant: 'primary',
                closeOnClick: false,
                onClick: async () => {
                    const firstName = content.querySelector('#admin-firstname').value.trim();
                    const lastName = content.querySelector('#admin-lastname').value.trim();
                    const phone = content.querySelector('#admin-phone').value.trim();
                    const email = content.querySelector('#admin-email').value.trim();
                    const password = content.querySelector('#admin-password').value;

                    if (!firstName || !lastName || !phone || !email || !password) {
                        ctx.Toast.warning('Tous les champs sont requis');
                        return;
                    }

                    try {
                        await apiCall(ctx, '/admins', {
                            method: 'POST',
                            body: JSON.stringify({
                                first_name: firstName,
                                last_name: lastName,
                                phone,
                                email,
                                password
                            })
                        });
                        ctx.Modal.close();
                        ctx.Toast.success('Administrateur créé');
                        await loadData(ctx);
                    } catch (e) {
                        ctx.Toast.error(e.message_key || 'Erreur lors de la création');
                    }
                }
            }
        ]
    });
}

const view = {
    render() {
        return `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Gestion des Administrateurs</div>
                </div>
                <div class="card-body" id="admins-content">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    },

    async mount(ctx) {
        await loadData(ctx);
    }
};

export default view;
