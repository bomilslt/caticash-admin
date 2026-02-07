/**
 * CatiCash Admin - Main Application
 * Handles routing, navigation, and view management.
 */

import { Toast } from './components/toast.js';
import { Modal } from './components/modal.js';

// Views
import dashboardView from './views/dashboard.js';
import servicesView from './views/services.js';
import usersView from './views/users.js';
import adminsView from './views/admins.js';
import transactionsView from './views/transactions.js';
import configView from './views/config.js';
import kycView from './views/kyc.js';
import loginView from './views/login.js';

const appEl = document.getElementById('app');
const pageTitleEl = document.getElementById('page-title');
const sidebarEl = document.getElementById('sidebar');
const sidebarNavEl = document.getElementById('sidebar-nav');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const logoutBtn = document.getElementById('logout-btn');
const topbarUserEl = document.getElementById('topbar-user');

// Navigation config
const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'services', label: 'Services', icon: 'layers' },
    { id: 'users', label: 'Clients', icon: 'users' },
    { id: 'admins', label: 'Admins', icon: 'shield' },
    { id: 'kyc', label: 'Validation KYC', icon: 'check' },
    { id: 'transactions', label: 'Transactions', icon: 'dollar' },
    { id: 'config', label: 'Configuration', icon: 'settings' },
];

// Route map
const routes = {
    dashboard: dashboardView,
    services: servicesView,
    users: usersView,
    admins: adminsView,
    kyc: kycView,
    transactions: transactionsView,
    config: configView,
    login: loginView
};

let currentView = null;

// Icons (inline SVG for simplicity)
const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

// Session helpers
function getSession() {
    try {
        return JSON.parse(localStorage.getItem('caticash.session.v1')) || null;
    } catch { return null; }
}

function isLoggedIn() {
    const session = getSession();
    return session && session.token && session.user?.is_admin;
}

function logout() {
    localStorage.removeItem('caticash.session.v1');
    navigate('login');
}

// API Base
function getApiBase() {
    if (window.CATICASH_CONFIG?.adminApiUrl) {
        return window.CATICASH_CONFIG.adminApiUrl;
    }
    return localStorage.getItem('katicash.apiBase') || 'http://localhost:5000/api/admin';
}

// Navigation
function getRouteName() {
    const hash = window.location.hash || '#/dashboard';
    const match = hash.match(/^#\/(\w+)/);
    return match ? match[1] : 'dashboard';
}

function navigate(route) {
    const next = `#/${route}`;
    if (window.location.hash === next) return;
    window.location.hash = next;
}

// Render navigation
function renderNav() {
    sidebarNavEl.innerHTML = navItems.map(item => `
    <div class="nav-item" data-route="${item.id}">
      ${icons[item.icon] || ''}
      <span>${item.label}</span>
    </div>
  `).join('');

    sidebarNavEl.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', () => {
            navigate(el.dataset.route);
            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                sidebarEl.classList.remove('open');
            }
        });
    });
}

function updateNavActive(routeName) {
    sidebarNavEl.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.route === routeName);
    });
}

// Render route
async function renderRoute() {
    const routeName = getRouteName();

    // Auth check
    if (!isLoggedIn() && routeName !== 'login') {
        navigate('login');
        return;
    }

    if (isLoggedIn() && routeName === 'login') {
        navigate('dashboard');
        return;
    }

    // Update UI
    updateNavActive(routeName);
    const navItem = navItems.find(n => n.id === routeName);
    if (pageTitleEl && navItem) pageTitleEl.textContent = navItem.label;

    // Show/hide sidebar for login
    if (sidebarEl) sidebarEl.style.display = routeName === 'login' ? 'none' : '';
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.marginLeft = routeName === 'login' ? '0' : '';

    // Unmount previous
    if (currentView?.unmount) {
        try { await currentView.unmount(); } catch { }
    }

    // Load view
    const view = routes[routeName] || routes.dashboard;
    currentView = view;

    // Render
    appEl.innerHTML = typeof view.render === 'function' ? view.render() : '';

    // Mount
    if (typeof view.mount === 'function') {
        await view.mount({
            root: appEl,
            Toast,
            Modal,
            navigate,
            getApiBase,
            getSession
        });
    }
}

// Init
function init() {
    renderNav();

    // Sidebar toggle (mobile)
    sidebarToggleBtn?.addEventListener('click', () => {
        sidebarEl.classList.toggle('open');
    });

    // Logout
    logoutBtn?.addEventListener('click', logout);

    // Update user display
    const session = getSession();
    if (topbarUserEl && session?.user) {
        topbarUserEl.textContent = session.user.phone || session.user.email || 'Admin';
    }

    // Initial route
    if (!window.location.hash) {
        window.location.hash = '#/dashboard';
    }

    window.addEventListener('hashchange', renderRoute);

    // Hide splash screen after first render
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        renderRoute().then(() => {
            setTimeout(() => {
                splashScreen.classList.add('fade-out');
                setTimeout(() => splashScreen.remove(), 600);
            }, 800);
        });
    } else {
        renderRoute();
    }
}

init();
