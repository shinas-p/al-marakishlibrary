/**
 * GLOBAL TOAST NOTIFICATION SYSTEM - JavaScript Controller
 * Al Marakish Library Management System
 * 
 * @author Claude (Deepmind Advanced Agentic Coding)
 * @version 2.0 - Production Ready
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.init();
    }

    init() {
        // Create container if doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Show a toast notification
     * @param {string} type - success, error, warning, info
     * @param {string} message - Message to display
     * @param {object} options - Additional options
     */
    show(type, message, options = {}) {
        const defaults = {
            title: this.getDefaultTitle(type),
            duration: 5000,
            closable: true,
            action: null, // { text: 'Undo', callback: function() {} }
            onClose: null
        };

        const config = { ...defaults, ...options };

        // Create toast element
        const toast = this.createToast(type, config.title, message, config);

        // Add to container
        this.container.appendChild(toast);

        // Trigger show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-hide
        if (config.duration > 0) {
            const progressBar = toast.querySelector('.toast-progress');
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.style.transition = `width ${config.duration}ms linear`;
                requestAnimationFrame(() => {
                    progressBar.style.width = '0%';
                });
            }

            setTimeout(() => {
                this.hide(toast, config.onClose);
            }, config.duration);
        }

        return toast;
    }

    createToast(type, title, message, config) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = this.getIcon(type);

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${this.escapeHtml(title)}</div>
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            ${config.action ? `<button class="toast-action" data-action="true">${this.escapeHtml(config.action.text)}</button>` : ''}
            ${config.closable ? '<button class="toast-close" data-close="true">×</button>' : ''}
            <div class="toast-progress"></div>
        `;

        // Event listeners
        const closeBtn = toast.querySelector('[data-close]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide(toast, config.onClose);
            });
        }

        const actionBtn = toast.querySelector('[data-action]');
        if (actionBtn && config.action && config.action.callback) {
            actionBtn.addEventListener('click', () => {
                config.action.callback();
                this.hide(toast);
            });
        }

        return toast;
    }

    hide(toast, onClose = null) {
        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            if (onClose) onClose();
        }, 400);
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    getDefaultTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || titles.info;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Convenience methods
    success(message, options = {}) {
        return this.show('success', message, options);
    }

    error(message, options = {}) {
        return this.show('error', message, options);
    }

    warning(message, options = {}) {
        return this.show('warning', message, options);
    }

    info(message, options = {}) {
        return this.show('info', message, options);
    }
}

// Initialize global toast manager
const toast = new ToastManager();

// Global function for easy access
function showToast(type, message, options = {}) {
    return toast.show(type, message, options);
}

// Convenience functions
function toastSuccess(message, options = {}) {
    return toast.success(message, options);
}

function toastError(message, options = {}) {
    return toast.error(message, options);
}

function toastWarning(message, options = {}) {
    return toast.warning(message, options);
}

function toastInfo(message, options = {}) {
    return toast.info(message, options);
}
