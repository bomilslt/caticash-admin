/**
 * Modal component
 */

const modalRoot = document.getElementById('modal-root');
let currentModal = null;

function open({ title, content, actions = [] }) {
    close();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
    <div class="modal-header">${title || ''}</div>
    <div class="modal-body"></div>
    <div class="modal-footer"></div>
  `;

    const bodyEl = modal.querySelector('.modal-body');
    if (typeof content === 'string') {
        bodyEl.innerHTML = content;
    } else if (content instanceof HTMLElement) {
        bodyEl.appendChild(content);
    }

    const footerEl = modal.querySelector('.modal-footer');
    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = `btn ${action.variant === 'primary' ? 'btn-primary' : 'btn-outline'}`;
        btn.textContent = action.label;
        btn.addEventListener('click', async () => {
            if (action.onClick) await action.onClick();
            if (action.closeOnClick !== false) close();
        });
        footerEl.appendChild(btn);
    });

    modalRoot.innerHTML = '';
    modalRoot.appendChild(modal);
    modalRoot.classList.add('active');
    currentModal = modal;

    // Close on backdrop click
    modalRoot.addEventListener('click', (e) => {
        if (e.target === modalRoot) close();
    });
}

function close() {
    modalRoot.classList.remove('active');
    modalRoot.innerHTML = '';
    currentModal = null;
}

export const Modal = { open, close };
