/**
 * FilterManager - Transaction filter state and indicator management
 * 
 * RESPONSIBILITIES:
 * - Apply transaction filters from UI inputs to TransactionUI state
 * - Clear all filters and reset to defaults
 * - Update filter indicator badge (visual feedback for active filters)
 * - Update filter indicator for pending changes (pulse animation)
 * 
 * STATE REQUIREMENTS:
 * - No encryption (reads UI inputs, writes to TransactionUI.filters)
 * - Works in any state (filter UI visible in Unlocked state)
 * 
 * FILTER TYPES:
 * - Category, Type, Account, Description (multi-select)
 * - Amount range (min/max)
 * - Date range (start/end)
 * - Boolean flags (unlinked transfers, uncategorized)
 * - Search query (separate from filters)
 * - Sort field and order
 * 
 * @class FilterManager
 * @module UI/Transaction
 * @layer 5 - UI Components
 */

export class FilterManager {
    /**
     * Create FilterManager
     * @param {TransactionUI} transactionUI - Parent UI coordinator (holds filter state)
     */
    constructor(transactionUI) {
        this.transactionUI = transactionUI;
    }

    /**
     * Apply transaction filters from UI inputs to TransactionUI state
     * Reads all filter inputs and updates transactionUI.filters object
     * 
     * FILTER INPUTS:
     * - category, type, account, description (multi-select)
     * - amountMin, amountMax (number)
     * - dateStart, dateEnd (date)
     * - unlinkedTransfers, uncategorized (checkbox)
     * 
     * USAGE: Call before renderTransactionsTab() to apply filters
     */
    applyTransactionFilters() {
        const categorySelect = document.getElementById('filter-category');
        const typeSelect = document.getElementById('filter-type');
        const accountSelect = document.getElementById('filter-account');
        const descriptionSelect = document.getElementById('filter-description');
        const amountMin = document.getElementById('filter-amount-min');
        const amountMax = document.getElementById('filter-amount-max');
        const dateStart = document.getElementById('filter-date-start');
        const dateEnd = document.getElementById('filter-date-end');
        const unlinkedTransfers = document.getElementById('filter-unlinked-transfers');
        const uncategorized = document.getElementById('filter-uncategorized');
        
        this.transactionUI.filters.categories = Array.from(categorySelect.selectedOptions).map(o => o.value);
        this.transactionUI.filters.types = Array.from(typeSelect.selectedOptions).map(o => o.value);
        this.transactionUI.filters.accounts = Array.from(accountSelect.selectedOptions).map(o => o.value);
        this.transactionUI.filters.descriptions = Array.from(descriptionSelect.selectedOptions).map(o => o.value);
        this.transactionUI.filters.amountMin = amountMin.value ? parseFloat(amountMin.value) : null;
        this.transactionUI.filters.amountMax = amountMax.value ? parseFloat(amountMax.value) : null;
        this.transactionUI.filters.dateStart = dateStart.value || null;
        this.transactionUI.filters.dateEnd = dateEnd.value || null;
        this.transactionUI.filters.unlinkedTransfersOnly = unlinkedTransfers ? unlinkedTransfers.checked : false;
        this.transactionUI.filters.uncategorizedOnly = uncategorized ? uncategorized.checked : false;
    }

    /**
     * Clear all transaction filters and reset to defaults
     * Resets UI inputs AND TransactionUI state
     * 
     * DEFAULTS:
     * - No filters selected
     * - Search: description field only
     * - Sort: date descending
     * 
     * USAGE: Called by "Clear" button in filter panel
     */
    clearTransactionFilters() {
        document.getElementById('transaction-search').value = '';
        document.getElementById('filter-category').selectedIndex = -1;
        document.getElementById('filter-type').selectedIndex = -1;
        document.getElementById('filter-account').selectedIndex = -1;
        document.getElementById('filter-description').selectedIndex = -1;
        document.getElementById('filter-amount-min').value = '';
        document.getElementById('filter-amount-max').value = '';
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        document.getElementById('sort-field').value = 'date';
        document.getElementById('sort-order').value = 'desc';
        
        const unlinkedTransfersCheckbox = document.getElementById('filter-unlinked-transfers');
        if (unlinkedTransfersCheckbox) {
            unlinkedTransfersCheckbox.checked = false;
        }
        
        const uncategorizedCheckbox = document.getElementById('filter-uncategorized');
        if (uncategorizedCheckbox) {
            uncategorizedCheckbox.checked = false;
        }
        
        document.getElementById('search-description').checked = true;
        document.getElementById('search-account').checked = false;
        document.getElementById('search-category').checked = false;
        document.getElementById('search-note').checked = false;
        
        this.transactionUI.searchQuery = '';
        this.transactionUI.searchFields = ['description'];
        this.transactionUI.sortField = 'date';
        this.transactionUI.sortOrder = 'desc';
        this.transactionUI.filters = {
            categories: [],
            types: [],
            accounts: [],
            descriptions: [],
            amountMin: null,
            amountMax: null,
            dateStart: null,
            dateEnd: null,
            unlinkedTransfersOnly: false,
            uncategorizedOnly: false
        };
    }

    /**
     * Update filter indicator badge on search bar
     * Shows visual feedback when filters are active
     * 
     * INDICATOR:
     * - .has-active-filters class added to search bar
     * - CSS displays badge or changes search bar style
     * 
     * TRIGGERS:
     * - Any filter selection
     * - Non-default sort
     * - Search query entered
     */
    updateFilterIndicator() {
        const searchBar = document.querySelector('.search-bar');
        if (!searchBar) return;
        
        const hasActiveFilters = 
            this.transactionUI.searchQuery ||
            this.transactionUI.filters.categories.length > 0 ||
            this.transactionUI.filters.accounts.length > 0 ||
            this.transactionUI.filters.descriptions.length > 0 ||
            this.transactionUI.filters.amountMin !== null ||
            this.transactionUI.filters.amountMax !== null ||
            this.transactionUI.filters.dateStart ||
            this.transactionUI.filters.dateEnd ||
            this.transactionUI.sortField !== 'date' ||
            this.transactionUI.sortOrder !== 'desc';
        
        if (hasActiveFilters) {
            searchBar.classList.add('has-active-filters');
        } else {
            searchBar.classList.remove('has-active-filters');
        }
    }
    
    /**
     * Update filter indicator to show pending changes
     * Adds pulse animation to "Apply" button
     * 
     * USAGE: Called when filter inputs change but not yet applied
     * VISUAL: .btn-pulse class triggers CSS animation
     */
    updateFilterIndicatorPending() {
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.classList.add('btn-pulse');
        }
    }
}
