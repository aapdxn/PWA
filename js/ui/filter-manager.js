/**
 * Filter Manager - Transaction filter logic
 * Extracts filter-related functionality from UIManager
 * Manages filter state, application, and indicator updates
 * 
 * @module FilterManager
 */

export class FilterManager {
    constructor(transactionUI) {
        this.transactionUI = transactionUI;
    }

    /**
     * Apply transaction filters from UI inputs
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
     * Update filter indicator based on active filters
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
     */
    updateFilterIndicatorPending() {
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.classList.add('btn-pulse');
        }
    }
}
