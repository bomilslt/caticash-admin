/**
 * Login view for Admin panel
 */

async function apiCall(base, path, options = {}) {
  const res = await fetch(`${base.replace('/api/admin', '/api/v1')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

const view = {
  render() {
    return `
      <div class="login-container">
        <div class="login-card">
          <div class="login-header">
            <img src="../assets/images/logo_caticash.png" alt="CatiCash" class="login-logo">
            <h1>Administration</h1>
            <p>Connectez-vous pour accéder au panneau d'administration</p>
          </div>
          <form id="login-form" class="login-form">
            <div class="field">
              <label class="label">Téléphone ou Email</label>
              <input type="text" class="input" id="login-identifier" placeholder="+237..." required>
            </div>
            <div class="field">
              <label class="label">Mot de passe</label>
              <input type="password" class="input" id="login-password" placeholder="••••••••" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="login-btn">
              Se connecter
            </button>
          </form>
        </div>
      </div>
      <style>
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
          padding: 24px;
        }
        .login-card {
          background: #fff;
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-logo {
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
        }
        .login-header h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #1e293b;
        }
        .login-header p {
          color: #64748b;
          font-size: 14px;
        }
        .login-form .field {
          margin-bottom: 20px;
        }
        .login-form .btn {
          margin-top: 8px;
        }
      </style>
    `;
  },
  async mount(ctx) {
    const form = ctx.root.querySelector('#login-form');
    const identifierInput = ctx.root.querySelector('#login-identifier');
    const passwordInput = ctx.root.querySelector('#login-password');
    const submitBtn = ctx.root.querySelector('#login-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const identifier = identifierInput.value.trim();
      const password = passwordInput.value;

      if (!identifier || !password) {
        ctx.Toast.warning('Veuillez remplir tous les champs');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Connexion...';

      try {
        const result = await apiCall(ctx.getApiBase(), '/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, password })
        });

        const payload = result.data;

        if (!payload.user?.is_admin) {
          ctx.Toast.error('Accès réservé aux administrateurs');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Se connecter';
          return;
        }

        // Save session
        localStorage.setItem('caticash.session.v1', JSON.stringify({
          token: payload.access_token,
          refreshToken: payload.refresh_token,
          user: payload.user
        }));

        ctx.Toast.success('Connexion réussie');
        ctx.navigate('dashboard');
      } catch (err) {
        ctx.Toast.error(err.message_key || 'Identifiants incorrects');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Se connecter';
      }
    });
  }
};

export default view;
