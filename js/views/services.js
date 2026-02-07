/**
 * Services configuration view (SMS, Email, Payment providers)
 */

let state = {
    services: [],
    providers: {},
    loading: true,
    error: null,
    activeTab: 'sms'
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
        const [servicesRes, providersRes] = await Promise.all([
            apiCall(ctx, '/services'),
            apiCall(ctx, '/services/available')
        ]);
        state.services = servicesRes.services || [];
        state.providers = providersRes.providers || {};
        state.loading = false;
    } catch (e) {
        state.error = e.message_key || 'Erreur de chargement';
        state.loading = false;
    }
    renderContent(ctx);
}

function renderContent(ctx) {
    const container = ctx.root.querySelector('#services-content');
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

    const typeServices = state.services.filter(s => s.service_type === state.activeTab);
    const typeProviders = state.providers[state.activeTab] || [];

    container.innerHTML = `
    <div class="section-header">
      <h3>${state.activeTab.toUpperCase()} Providers</h3>
      <button class="btn btn-primary btn-sm" id="add-provider-btn">+ Ajouter</button>
    </div>
    ${typeServices.length === 0 ? `
      <div class="empty-state">Aucun provider configuré</div>
    ` : `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Priorité</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${typeServices.map(s => {
        const prov = typeProviders.find(p => p.provider === s.provider);
        return `
                <tr>
                  <td><strong>${escapeHTML(prov?.name || s.provider)}</strong></td>
                  <td>${s.priority}</td>
                  <td>
                    <span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">
                      ${s.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline" data-toggle="${s.id}">
                      ${s.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button class="btn btn-sm btn-outline" data-edit="${s.id}">Config</button>
                    <button class="btn btn-sm btn-outline" data-test="${s.id}">Test</button>
                    <button class="btn btn-sm btn-danger" data-delete="${s.id}">×</button>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

    // Add provider button
    container.querySelector('#add-provider-btn')?.addEventListener('click', () => openAddModal(ctx));

    // Toggle buttons
    container.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await apiCall(ctx, `/services/${btn.dataset.toggle}/toggle`, { method: 'POST' });
                await loadData(ctx);
                ctx.Toast.success('Statut modifié');
            } catch (e) {
                ctx.Toast.error('Erreur');
            }
        });
    });

    // Edit buttons
    container.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
            const service = state.services.find(s => s.id === parseInt(btn.dataset.edit));
            if (service) openEditModal(ctx, service);
        });
    });

    // Delete buttons
    container.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Supprimer ce provider ?')) return;
            try {
                await apiCall(ctx, `/services/${btn.dataset.delete}`, { method: 'DELETE' });
                await loadData(ctx);
                ctx.Toast.success('Provider supprimé');
            } catch (e) {
                ctx.Toast.error('Erreur');
            }
        });
    });

    // Test buttons
    container.querySelectorAll('[data-test]').forEach(btn => {
        btn.addEventListener('click', () => {
            const service = state.services.find(s => s.id === parseInt(btn.dataset.test));
            if (service) openTestModal(ctx, service);
        });
    });
}

function openAddModal(ctx) {
    const providers = state.providers[state.activeTab] || [];
    const existing = state.services.filter(s => s.service_type === state.activeTab).map(s => s.provider);
    const available = providers.filter(p => !existing.includes(p.provider));

    if (available.length === 0) {
        ctx.Toast.warning('Tous les providers sont déjà configurés');
        return;
    }

    const content = document.createElement('div');
    content.innerHTML = `
    <div class="field">
      <label class="label">Provider</label>
      <select class="input" id="modal-provider">
        ${available.map(p => `<option value="${p.provider}">${escapeHTML(p.name)}</option>`).join('')}
      </select>
    </div>
    <div id="modal-config"></div>
    <div class="field">
      <label class="label">Priorité</label>
      <input type="number" class="input" id="modal-priority" value="10" min="1" max="100">
    </div>
  `;

    const providerSelect = content.querySelector('#modal-provider');
    const configContainer = content.querySelector('#modal-config');

    const updateConfig = () => {
        const prov = available.find(p => p.provider === providerSelect.value);
        if (!prov) return;
        configContainer.innerHTML = Object.entries(prov.config_schema || {}).map(([key, schema]) => `
      <div class="field">
        <label class="label">${escapeHTML(schema.label)}${schema.required ? ' *' : ''}</label>
        <input type="${schema.type === 'password' ? 'password' : 'text'}" class="input" data-key="${key}" placeholder="${escapeHTML(schema.placeholder || '')}">
      </div>
    `).join('');
    };

    providerSelect.addEventListener('change', updateConfig);
    updateConfig();

    ctx.Modal.open({
        title: `Ajouter ${state.activeTab.toUpperCase()}`,
        content,
        actions: [
            { label: 'Annuler' },
            {
                label: 'Créer',
                variant: 'primary',
                closeOnClick: false,
                onClick: async () => {
                    const config = {};
                    content.querySelectorAll('[data-key]').forEach(el => {
                        config[el.dataset.key] = el.value;
                    });
                    try {
                        await apiCall(ctx, '/services', {
                            method: 'POST',
                            body: JSON.stringify({
                                service_type: state.activeTab,
                                provider: providerSelect.value,
                                config,
                                priority: parseInt(content.querySelector('#modal-priority').value) || 10,
                                is_active: false
                            })
                        });
                        ctx.Modal.close();
                        ctx.Toast.success('Provider ajouté');
                        await loadData(ctx);
                    } catch (e) {
                        ctx.Toast.error('Erreur');
                    }
                }
            }
        ]
    });
}

function openEditModal(ctx, service) {
    const providers = state.providers[service.service_type] || [];
    const prov = providers.find(p => p.provider === service.provider);
    if (!prov) return;

    const content = document.createElement('div');
    content.innerHTML = `
    <div style="margin-bottom:16px;font-weight:600">${escapeHTML(prov.name)}</div>
    <div id="modal-config"></div>
    <div class="field">
      <label class="label">Priorité</label>
      <input type="number" class="input" id="modal-priority" value="${service.priority}" min="1" max="100">
    </div>
  `;

    const configContainer = content.querySelector('#modal-config');
    configContainer.innerHTML = Object.entries(prov.config_schema || {}).map(([key, schema]) => `
    <div class="field">
      <label class="label">${escapeHTML(schema.label)}</label>
      <input type="${schema.type === 'password' ? 'password' : 'text'}" class="input" data-key="${key}" value="${escapeHTML(service.config?.[key] || '')}">
    </div>
  `).join('');

    ctx.Modal.open({
        title: `Configurer ${prov.name}`,
        content,
        actions: [
            { label: 'Annuler' },
            {
                label: 'Enregistrer',
                variant: 'primary',
                closeOnClick: false,
                onClick: async () => {
                    const config = {};
                    content.querySelectorAll('[data-key]').forEach(el => {
                        config[el.dataset.key] = el.value;
                    });
                    try {
                        await apiCall(ctx, `/services/${service.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                config,
                                priority: parseInt(content.querySelector('#modal-priority').value) || 10
                            })
                        });
                        ctx.Modal.close();
                        ctx.Toast.success('Configuration enregistrée');
                        await loadData(ctx);
                    } catch (e) {
                        ctx.Toast.error('Erreur');
                    }
                }
            }
        ]
    });
}

function openTestModal(ctx, service) {
    const content = document.createElement('div');

    if (service.service_type === 'payment') {
        content.innerHTML = '<p>Test non disponible pour les providers de paiement.</p>';
        ctx.Modal.open({ title: 'Test', content, actions: [{ label: 'Fermer' }] });
        return;
    }

    content.innerHTML = `
    <div class="field">
      <label class="label">${service.service_type === 'sms' ? 'Numéro de test' : 'Email de test'}</label>
      <input type="${service.service_type === 'sms' ? 'tel' : 'email'}" class="input" id="test-dest" placeholder="${service.service_type === 'sms' ? '+237...' : 'test@example.com'}">
    </div>
    <div id="test-result"></div>
  `;

    ctx.Modal.open({
        title: `Tester ${service.provider}`,
        content,
        actions: [
            { label: 'Fermer' },
            {
                label: 'Envoyer',
                variant: 'primary',
                closeOnClick: false,
                onClick: async () => {
                    const dest = content.querySelector('#test-dest').value;
                    const resultEl = content.querySelector('#test-result');
                    if (!dest) {
                        ctx.Toast.warning('Destination requise');
                        return;
                    }
                    resultEl.innerHTML = '<p>Test en cours...</p>';
                    try {
                        const endpoint = service.service_type === 'sms' ? '/services/test/sms' : '/services/test/email';
                        const result = await apiCall(ctx, endpoint, {
                            method: 'POST',
                            body: JSON.stringify({
                                provider: service.provider,
                                config: service.config,
                                [service.service_type === 'sms' ? 'test_phone' : 'test_email']: dest
                            })
                        });
                        resultEl.innerHTML = result.success
                            ? '<p style="color:green">✓ Test réussi!</p>'
                            : `<p style="color:red">✗ Échec: ${escapeHTML(result.error_message)}</p>`;
                    } catch (e) {
                        resultEl.innerHTML = `<p style="color:red">✗ Erreur: ${escapeHTML(e.error_message || e.message_key)}</p>`;
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
          <div class="tabs" id="service-tabs">
            <button class="tab active" data-tab="sms">SMS</button>
            <button class="tab" data-tab="email">Email</button>
            <button class="tab" data-tab="payment">Paiement</button>
          </div>
        </div>
        <div class="card-body" id="services-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
      <style>
        .tabs { display: flex; gap: 8px; }
        .tab {
          padding: 8px 16px;
          border: none;
          background: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
          color: #64748b;
        }
        .tab:hover { background: #f1f5f9; }
        .tab.active { background: #2563eb; color: #fff; }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .section-header h3 { margin: 0; font-size: 16px; }
      </style>
    `;
    },

    async mount(ctx) {
        // Tab switching
        ctx.root.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                ctx.root.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.activeTab = tab.dataset.tab;
                renderContent(ctx);
            });
        });

        await loadData(ctx);
    }
};

export default view;
