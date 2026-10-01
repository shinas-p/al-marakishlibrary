/**
 * ============================================================================
 * BULK SELECTION SYSTEM - CENTRALIZED JAVASCRIPT
 * ============================================================================
 * Al Marakish Library Management System
 * 
 * Purpose: Reusable selection logic for ALL bulk tables across the project
 * Used by: bulk_manage_books.php, bulk_manage_users.php, print_labels.php, etc.
 * 
 * Key Features:
 * - Row-click selection (entire row is clickable)
 * - Checkbox synchronization
 * - "Select All" with indeterminate state
 * - Keyboard navigation (Space, Enter, Shift+Click)
 * - Session persistence across filters
 * - Touch-friendly interactions
 * - Accessibility compliant (ARIA attributes)
 * 
 * Version: 1.0
 * Date: 2026-01-06
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * BulkSelectionManager - Main class for managing bulk selection
     */
    class BulkSelectionManager {
        constructor(options = {}) {
            // Configuration
            this.config = {
                tableSelector: options.tableSelector || '.bulk-table',
                rowSelector: options.rowSelector || '.bulk-row',
                checkboxSelector: options.checkboxSelector || '.bulk-row-checkbox',
                selectAllSelector: options.selectAllSelector || '.bulk-select-all',
                toolbarSelector: options.toolbarSelector || '.bulk-toolbar',
                countSelector: options.countSelector || '.bulk-count',
                persistenceKey: options.persistenceKey || null, // Set by page (e.g., 'books', 'users')
                onSelectionChange: options.onSelectionChange || null,
                ...options
            };

            // State
            this.selectedIds = new Set();
            this.lastSelectedIndex = null;
            this.isShiftPressed = false;

            // DOM elements
            this.table = null;
            this.rows = [];
            this.checkboxes = [];
            this.selectAllCheckbox = null;
            this.toolbar = null;
            this.countDisplay = null;

            // Initialize
            this.init();
        }

        /**
         * Initialize the bulk selection system
         */
        init() {
            // Find DOM elements
            this.table = document.querySelector(this.config.tableSelector);

            if (!this.table) {
                console.warn('BulkSelectionManager: Table not found');
                return;
            }

            this.selectAllCheckbox = document.querySelector(this.config.selectAllSelector);
            this.toolbar = document.querySelector(this.config.toolbarSelector);
            this.countDisplay = document.querySelector(this.config.countSelector);

            // Get all rows and checkboxes
            this.updateRowReferences();

            // Restore persisted selection
            this.restoreSelection();

            // Bind events
            this.bindEvents();

            // Update UI
            this.updateUI();

            console.log('BulkSelectionManager initialized with', this.rows.length, 'rows');
        }

        /**
         * Update references to rows and checkboxes (call after DOM changes)
         */
        updateRowReferences() {
            this.rows = Array.from(this.table.querySelectorAll(this.config.rowSelector));
            this.checkboxes = Array.from(this.table.querySelectorAll(this.config.checkboxSelector));
        }

        /**
         * Bind all event listeners using Event Delegation
         */
        bindEvents() {
            // Select All checkbox (This is outside the table body, so direct binding is fine)
            if (this.selectAllCheckbox) {
                this.selectAllCheckbox.addEventListener('change', (e) => {
                    this.handleSelectAll(e);
                });
            }

            // Event Delegation for Table Clicks (Row Selection)
            this.table.addEventListener('click', (e) => {
                const row = e.target.closest(this.config.rowSelector);
                if (!row) return;

                // Stop delegation if it's an interactive element
                if (this.isInteractiveElement(e.target)) return;

                // Find the index of this row
                const rowIndex = this.rows.indexOf(row);
                this.handleRowClick(row, rowIndex, e);
            });

            // Event Delegation for Table Changes (Checkbox Toggles)
            this.table.addEventListener('change', (e) => {
                const checkbox = e.target.closest(this.config.checkboxSelector);
                if (!checkbox) return;

                this.handleCheckboxChange(checkbox, e);
            });

            // Keyboard events for accessibility (Delegated)
            this.table.addEventListener('keydown', (e) => {
                const row = e.target.closest(this.config.rowSelector);
                if (!row) return;

                const rowIndex = this.rows.indexOf(row);
                this.handleRowKeyboard(row, rowIndex, e);
            });

            // Track Shift key (Global)
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Shift') this.isShiftPressed = true;
            });

            document.addEventListener('keyup', (e) => {
                if (e.key === 'Shift') {
                    this.isShiftPressed = false;
                    this.lastSelectedIndex = null;
                }
            });

            // Toolbar clear button
            if (this.toolbar) {
                this.toolbar.addEventListener('click', (e) => {
                    const clearBtn = e.target.closest('[data-bulk-action="clear"]');
                    if (clearBtn || e.target.closest('.bulk-btn-secondary')) {
                        // Only clear if it's a "Cancel" or "Clear" button
                        if (e.target.textContent.toLowerCase().includes('cancel') || e.target.textContent.toLowerCase().includes('clear')) {
                            this.clearSelection();
                        }
                    }
                });
            }
        }

        /**
         * Handle row click
         */
        handleRowClick(row, index, event) {
            // Ignore clicks on interactive elements
            if (this.isInteractiveElement(event.target)) {
                return;
            }

            // Get row ID
            const id = row.dataset.bulkId;
            if (!id) return;

            // Shift+Click for range selection
            if (this.isShiftPressed && this.lastSelectedIndex !== null) {
                this.selectRange(this.lastSelectedIndex, index);
            } else {
                // Toggle single row
                this.toggleRow(row, id);
                this.lastSelectedIndex = index;
            }

            this.updateUI();
            this.persistSelection();
        }

        /**
         * Handle keyboard navigation on rows
         */
        handleRowKeyboard(row, index, event) {
            const id = row.dataset.bulkId;
            if (!id) return;

            // Space or Enter to toggle
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                this.toggleRow(row, id);
                this.lastSelectedIndex = index;
                this.updateUI();
                this.persistSelection();
            }

            // Arrow keys for navigation
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const nextRow = this.rows[index + 1];
                if (nextRow) nextRow.focus();
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                const prevRow = this.rows[index - 1];
                if (prevRow) prevRow.focus();
            }
        }

        /**
         * Handle individual checkbox change
         */
        handleCheckboxChange(checkbox, event) {
            const row = checkbox.closest(this.config.rowSelector);
            const id = row?.dataset.bulkId;

            if (!id) return;

            if (checkbox.checked) {
                this.selectRow(row, id);
            } else {
                this.deselectRow(row, id);
            }

            this.updateUI();
            this.persistSelection();
        }

        /**
         * Handle Select All checkbox
         */
        handleSelectAll(event) {
            const checked = event.target.checked;

            // Get only VISIBLE rows (respects filters)
            const visibleRows = this.rows.filter(row => {
                return row.offsetParent !== null; // Check if element is visible
            });

            if (checked) {
                // Select all visible rows
                visibleRows.forEach(row => {
                    const id = row.dataset.bulkId;
                    if (id) {
                        this.selectRow(row, id);
                    }
                });
            } else {
                // Deselect all visible rows
                visibleRows.forEach(row => {
                    const id = row.dataset.bulkId;
                    if (id) {
                        this.deselectRow(row, id);
                    }
                });
            }

            this.updateUI();
            this.persistSelection();
        }

        /**
         * Select a range of rows (Shift+Click)
         */
        selectRange(startIndex, endIndex) {
            const [start, end] = startIndex < endIndex
                ? [startIndex, endIndex]
                : [endIndex, startIndex];

            for (let i = start; i <= end; i++) {
                const row = this.rows[i];
                const id = row?.dataset.bulkId;

                if (id && row.offsetParent !== null) { // Only visible rows
                    this.selectRow(row, id);
                }
            }
        }

        /**
         * Toggle row selection
         */
        toggleRow(row, id) {
            if (this.selectedIds.has(id)) {
                this.deselectRow(row, id);
            } else {
                this.selectRow(row, id);
            }
        }

        /**
         * Select a row
         */
        selectRow(row, id) {
            this.selectedIds.add(id);
            row.classList.add('selected');
            row.setAttribute('aria-checked', 'true');

            const checkbox = row.querySelector(this.config.checkboxSelector);
            if (checkbox) checkbox.checked = true;
        }

        /**
         * Deselect a row
         */
        deselectRow(row, id) {
            this.selectedIds.delete(id);
            row.classList.remove('selected');
            row.setAttribute('aria-checked', 'false');

            const checkbox = row.querySelector(this.config.checkboxSelector);
            if (checkbox) checkbox.checked = false;
        }

        /**
         * Clear all selections
         */
        clearSelection() {
            this.rows.forEach(row => {
                const id = row.dataset.bulkId;
                if (id) {
                    this.deselectRow(row, id);
                }
            });

            this.selectedIds.clear();
            this.lastSelectedIndex = null;

            this.updateUI();
            this.persistSelection();
        }

        /**
         * Update UI (count, toolbar, select all state)
         */
        updateUI() {
            const count = this.selectedIds.size;

            // Update count display
            if (this.countDisplay) {
                this.countDisplay.textContent = count;
            }

            // Show/hide toolbar
            if (this.toolbar) {
                if (count > 0) {
                    this.toolbar.classList.add('active');
                } else {
                    this.toolbar.classList.remove('active');
                }
            }

            // Update Select All checkbox state
            if (this.selectAllCheckbox) {
                const visibleRows = this.rows.filter(row => row.offsetParent !== null);
                const visibleCount = visibleRows.length;
                const visibleSelectedCount = visibleRows.filter(row =>
                    row.classList.contains('selected')
                ).length;

                if (visibleSelectedCount === 0) {
                    this.selectAllCheckbox.checked = false;
                    this.selectAllCheckbox.indeterminate = false;
                } else if (visibleSelectedCount === visibleCount) {
                    this.selectAllCheckbox.checked = true;
                    this.selectAllCheckbox.indeterminate = false;
                } else {
                    this.selectAllCheckbox.checked = false;
                    this.selectAllCheckbox.indeterminate = true;
                }
            }

            // Fire callback if provided
            if (typeof this.config.onSelectionChange === 'function') {
                this.config.onSelectionChange(Array.from(this.selectedIds), count);
            }
        }

        /**
         * Persist selection to sessionStorage
         */
        persistSelection() {
            if (!this.config.persistenceKey) return;

            try {
                const data = {
                    ids: Array.from(this.selectedIds),
                    timestamp: Date.now()
                };

                sessionStorage.setItem(
                    `bulk_selection_${this.config.persistenceKey}`,
                    JSON.stringify(data)
                );
            } catch (e) {
                console.warn('Failed to persist selection:', e);
            }
        }

        /**
         * Restore selection from sessionStorage
         */
        restoreSelection() {
            if (!this.config.persistenceKey) return;

            try {
                const stored = sessionStorage.getItem(`bulk_selection_${this.config.persistenceKey}`);

                if (!stored) return;

                const data = JSON.parse(stored);

                // Check if data is recent (within 30 minutes)
                const age = Date.now() - (data.timestamp || 0);
                if (age > 30 * 60 * 1000) {
                    // Data too old, clear it
                    this.clearPersistedSelection();
                    return;
                }

                // Restore selections
                data.ids.forEach(id => {
                    const row = this.rows.find(r => r.dataset.bulkId === String(id));
                    if (row) {
                        this.selectRow(row, String(id));
                    }
                });

                console.log('Restored', this.selectedIds.size, 'selections from session');

            } catch (e) {
                console.warn('Failed to restore selection:', e);
            }
        }

        /**
         * Clear persisted selection
         */
        clearPersistedSelection() {
            if (!this.config.persistenceKey) return;

            try {
                sessionStorage.removeItem(`bulk_selection_${this.config.persistenceKey}`);
            } catch (e) {
                console.warn('Failed to clear persisted selection:', e);
            }
        }

        /**
         * Check if element is interactive (should not trigger row selection)
         */
        isInteractiveElement(element) {
            // Check element tag
            const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
            if (interactiveTags.includes(element.tagName)) {
                return true;
            }

            // Check for interactive roles
            const role = element.getAttribute('role');
            if (['button', 'link', 'checkbox'].includes(role)) {
                return true;
            }

            // Check if element or parent has data-no-select attribute
            if (element.closest('[data-no-select]')) {
                return true;
            }

            return false;
        }

        /**
         * Get selected IDs
         */
        getSelectedIds() {
            return Array.from(this.selectedIds);
        }

        /**
         * Get selected count
         */
        getSelectedCount() {
            return this.selectedIds.size;
        }

        /**
         * Programmatically select items by ID
         */
        selectByIds(ids) {
            ids.forEach(id => {
                const row = this.rows.find(r => r.dataset.bulkId === String(id));
                if (row) {
                    this.selectRow(row, String(id));
                }
            });

            this.updateUI();
            this.persistSelection();
        }

        /**
         * Refresh (call after DOM updates like filtering)
         */
        refresh() {
            this.updateRowReferences();
            this.updateUI();
        }

        /**
         * Destroy the instance (cleanup)
         */
        destroy() {
            // Clear persisted data
            this.clearPersistedSelection();

            // Remove all event listeners (note: this is simplified)
            // In production, you'd track listeners and remove them properly
            console.log('BulkSelectionManager destroyed');
        }
    }
    /** bulk button  */
    function submitBulkEdit() {
        const btn = document.querySelector('.btn-apply');
        btn.classList.add('loading');
        btn.innerText = 'Applying...';

        // your existing submit logic continues
    }

    /**
     * Auto-initialize on DOM ready
     */
    function autoInit() {
        // Check if page has bulk table
        const table = document.querySelector('.bulk-table');
        if (!table) return;

        // Get context from table data attribute
        const context = table.dataset.bulkType || 'default';

        // Initialize manager
        window.bulkManager = new BulkSelectionManager({
            persistenceKey: context,
            onSelectionChange: (ids, count) => {
                // Optional: Global callback
                console.log('Selection changed:', count, 'items selected');
            }
        });

        console.log('Bulk selection auto-initialized for context:', context);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    // Export to global scope
    window.BulkSelectionManager = BulkSelectionManager;

})();
