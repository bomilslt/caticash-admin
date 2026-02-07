/**
 * Admin configuration view
 * Edit commissions, limits, and other app settings
 */

let state = {
    configs: [],
    loading: true,
    saving: false,
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

async function loadConfigs(ctx) {
    state.loading = true;
    state.error = null;
    renderContent(ctx);

    try {
        const result = await apiCall(ctx, '/config');
        state.configs = result.configs || [];
        state.loading = false;
    } catch (e) {
        state.error = e.message_key || 'Erreur de chargement';
        state.loading = false;
    }
    renderContent(ctx);
}

function renderContent(ctx) {
    const container = ctx.root.querySelector('#config-content');
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
        container.querySelector('#retry-btn')?.addEventListener('click', () => loadConfigs(ctx));
        return;
    }

    container.innerHTML = `
        <form id="config-form">
            ${state.configs.map(cfg => `
                <div class="field">
                    <label class="label">${escapeHTML(cfg.description || cfg.key)}</label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <input 
                            type="${cfg.value_type === 'float' || cfg.value_type === 'int' ? 'number' : 'text'}"
                            class="input" 
                            name="${cfg.key}"
                            value="${escapeHTML(cfg.raw_value)}"
                            ${cfg.value_type === 'float' ? 'step="0.01"' : ''}
                            style="flex:1"
                        >
                        <span class="badge badge-info">${cfg.value_type}</span>
                    </div>
                    <small style="color:var(--color-text-muted)">${cfg.key}</small>
                </div>
            `).join('')}
            <div style="margin-top:24px;">
                <button type="submit" class="btn btn-primary" ${state.saving ? 'disabled' : ''}>
                    ${state.saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>
        </form>
    `;

    container.querySelector('#config-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveConfigs(ctx, e.target);
    });
}

async function saveConfigs(ctx, form) {
    state.saving = true;
    renderContent(ctx);

    const formData = new FormData(form);
    const updates = {};

    for (const [key, value] of formData.entries()) {
        updates[key] = value;
    }

    try {
        await apiCall(ctx, '/config', {
            method: 'PUT',
            body: JSON.stringify({ configs: updates })
        });
        ctx.Toast.success('Configuration enregistrée');
        state.saving = false;
        await loadConfigs(ctx);
    } catch (e) {
        ctx.Toast.error(e.message_key || 'Erreur lors de la sauvegarde');
        state.saving = false;
        renderContent(ctx);
    }
}

const view = {
    render() {
        return `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Configuration de l'Application</div>
                </div>
                <div class="card-body" id="config-content">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    },

    async mount(ctx) {
        await loadConfigs(ctx);
    }
};

export default view;
