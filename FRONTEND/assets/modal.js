/**
 * CENTRALIZED CONFIRMATION MODAL SYSTEM - JavaScript Controller
 * Replaces ALL browser alert(), confirm(), prompt()
 * Al Marakish Library Management System
 * 
 * @author Claude (Deepmind Advanced Agentic Coding)
 * @version 2.0 - Production Ready
 */

class ConfirmModal {
    constructor() {
        this.overlay = null;
        this.currentResolve = null;
        this.currentReject = null;
        this.init();
    }

    init() {
        // Create modal HTML if doesn't exist
        if (!document.getElementById('confirm-modal')) {
            const modalHTML = `
                <div id="confirm-modal" class="modal-overlay">
                    <div class="modal-container">
                        <div class="modal-header">
                            <div class="modal-icon" id="modal-icon"></div>
                            <div class="modal-title-group">
                                <h3 class="modal-title" id="modal-title"></h3>
                                <p class="modal-subtitle" id="modal-subtitle"></p>
                            </div>
                        </div>
                        <div class="modal-body">
                            <div class="modal-message" id="modal-message"></div>
                            <div class="modal-details" id="modal-details" style="display:none;"></div>
                            <div class="modal-input-group" id="modal-input-group" style="display:none;">
                                <label class="modal-input-label" id="modal-input-label"></label>
                                <input type="text" class="modal-input" id="modal-input" autocomplete="off">
                                <div class="modal-input-hint" id="modal-input-hint"></div>
                                <div class="modal-input-error" id="modal-input-error"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="modal-btn modal-btn-cancel" id="modal-cancel">Cancel</button>
                            <button class="modal-btn modal-btn-confirm" id="modal-confirm">Confirm</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.overlay = document.getElementById('confirm-modal');
        this.bindEvents();
    }

    bindEvents() {
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');
        const input = document.getElementById('modal-input');

        cancelBtn.addEventListener('click', () => this.cancel());
        confirmBtn.addEventListener('click', () => this.confirm());

        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.cancel();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.cancel();
            }
        });

        // Input validation
        input.addEventListener('input', () => {
            this.validateInput();
        });

        // Enter key to confirm
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.confirm();
            }
        });
    }

    /**
     * Show confirmation modal
     * @param {object} config - Configuration object
     * @returns {Promise} - Resolves to true if confirmed, false if cancelled
     */
    show(config) {
        return new Promise((resolve, reject) => {
            this.currentResolve = resolve;
            this.currentReject = reject;

            const defaults = {
                title: 'Confirm Action',
                subtitle: '',
                message: 'Are you sure you want to proceed?',
                type: 'danger', // danger, warning, info
                icon: '⚠',
                details: null, // { label: 'value', ... }
                requireKeyword: null, // 'DELETE', 'SUSPEND', etc.
                keywordLabel: 'Type to confirm',
                keywordHint: '',
                confirmText: 'Confirm',
                cancelText: 'Cancel',
                detailsHtml: null,
                onConfirm: null,
                onCancel: null
            };

            const options = { ...defaults, ...config };

            // Set content
            document.getElementById('modal-title').textContent = options.title;
            document.getElementById('modal-subtitle').textContent = options.subtitle;
            document.getElementById('modal-message').innerHTML = options.message;

            // Set icon
            const iconEl = document.getElementById('modal-icon');
            iconEl.textContent = options.icon;
            iconEl.className = `modal-icon ${options.type}`;

            // Set details
            const detailsEl = document.getElementById('modal-details');
            if (options.details || options.detailsHtml) {
                detailsEl.style.display = 'block';
                let html = '';

                if (options.details) {
                    html += Object.entries(options.details)
                        .map(([label, value]) => `
                            <div class="modal-details-item">
                                <span class="modal-details-label">${this.escapeHtml(label)}:</span>
                                <span class="modal-details-value">${this.escapeHtml(value)}</span>
                            </div>
                        `)
                        .join('');
                }

                if (options.detailsHtml) {
                    html += options.detailsHtml;
                }

                detailsEl.innerHTML = html;
            } else {
                detailsEl.style.display = 'none';
            }

            // Set input
            const inputGroup = document.getElementById('modal-input-group');
            const input = document.getElementById('modal-input');
            const confirmBtn = document.getElementById('modal-confirm');

            if (options.requireKeyword) {
                inputGroup.style.display = 'block';
                document.getElementById('modal-input-label').textContent = options.keywordLabel;
                document.getElementById('modal-input-hint').textContent = options.keywordHint || `Type "${options.requireKeyword}" to confirm`;
                input.value = '';
                input.dataset.required = options.requireKeyword;
                confirmBtn.disabled = true;

                // Focus input after modal shows
                setTimeout(() => input.focus(), 300);
            } else {
                inputGroup.style.display = 'none';
                delete input.dataset.required;
                confirmBtn.disabled = false;
            }

            // Set buttons
            document.getElementById('modal-cancel').textContent = options.cancelText;
            const confirmBtnEl = document.getElementById('modal-confirm');
            confirmBtnEl.textContent = options.confirmText;
            confirmBtnEl.className = `modal-btn modal-btn-confirm ${options.type}`;

            // Store callbacks
            this.onConfirmCallback = options.onConfirm;
            this.onCancelCallback = options.onCancel;

            // Show modal
            setTimeout(() => {
                this.overlay.classList.add('active');
            }, 10);
        });
    }

    validateInput() {
        const input = document.getElementById('modal-input');
        const confirmBtn = document.getElementById('modal-confirm');
        const required = input.dataset.required;

        if (!required) {
            return true;
        }

        if (input.value === required) {
            input.classList.remove('error');
            confirmBtn.disabled = false;
            return true;
        } else {
            if (input.value.length > 0) {
                input.classList.add('error');
            }
            confirmBtn.disabled = true;
            return false;
        }
    }

    async confirm() {
        if (!this.validateInput()) {
            return;
        }

        const confirmBtn = document.getElementById('modal-confirm');
        confirmBtn.classList.add('loading');

        try {
            if (this.onConfirmCallback) {
                await this.onConfirmCallback();
            }

            this.hide();

            if (this.currentResolve) {
                this.currentResolve(true);
            }
        } catch (error) {
            confirmBtn.classList.remove('loading');
            toastError('Action failed: ' + error.message);
            throw error;
        }
    }

    cancel() {
        if (this.onCancelCallback) {
            this.onCancelCallback();
        }

        this.hide();

        if (this.currentResolve) {
            this.currentResolve(false);
        }
    }

    hide() {
        this.overlay.classList.remove('active');

        setTimeout(() => {
            // Clean up
            document.getElementById('modal-input').value = '';
            document.getElementById('modal-input').classList.remove('error');
            document.getElementById('modal-confirm').classList.remove('loading');
            document.getElementById('modal-confirm').disabled = false;
        }, 300);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Convenience methods
    danger(config) {
        return this.show({ ...config, type: 'danger', icon: '🗑️' });
    }

    warning(config) {
        return this.show({ ...config, type: 'warning', icon: '⚠' });
    }

    info(config) {
        return this.show({ ...config, type: 'info', icon: 'ℹ' });
    }
}

// Initialize global modal
const confirmModal = new ConfirmModal();

// Global convenience functions
async function showConfirm(config) {
    return await confirmModal.show(config);
}

async function confirmDanger(config) {
    return await confirmModal.danger(config);
}

async function confirmWarning(config) {
    return await confirmModal.warning(config);
}

async function confirmInfo(config) {
    return await confirmModal.info(config);
}

// Replace browser confirm/alert (optional, for backwards compatibility)
function confirmAction(message, title = 'Confirm') {
    return showConfirm({
        title: title,
        message: message
    });
}
