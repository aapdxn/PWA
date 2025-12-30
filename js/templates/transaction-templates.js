/**
 * TransactionTemplates - Reusable transaction generation functions
 * 
 * Provides factory functions for creating common transaction types:
 * - Split transactions (dividends with tax split)
 * - Transfer transactions (linked pairs)
 * - Recurring transactions
 * 
 * USAGE:
 * Import desired template functions and call with appropriate parameters.
 * All functions return transaction objects ready for database insertion.
 * 
 * @module Templates/Transaction
 * @layer 4 - Templates (Reusable patterns)
 */

/**
 * Generates HTML for empty state display when no transactions exist
 * 
 * Displays a centered message with inbox icon prompting user to add first transaction.
 * Used by TransactionUI when database has zero transactions.
 * 
 * @returns {string} HTML string containing empty state markup
 * @example
 * const html = emptyStateTemplate();
 * container.innerHTML = html;
 */
export const emptyStateTemplate = () => `
    <div class="transactions-scroll-container">
        <div class="empty-state">
            <div class="empty-state-icon">
                <i data-lucide="inbox" style="width: 64px; height: 64px;"></i>
            </div>
            <h3>No Transactions Yet</h3>
            <p>Use the + button below to get started</p>
        </div>
    </div>
`;

/**
 * Generates HTML for no results state when search/filter returns empty
 * 
 * Displays message indicating no transactions match current search criteria.
 * Used by TransactionUI when filters are active but produce no matches.
 * 
 * @returns {string} HTML string containing no results message
 * @example
 * const html = noResultsTemplate();
 * container.innerHTML = html;
 */
export const noResultsTemplate = () => `
    <div class="empty-state">
        <p>No transactions match your search</p>
    </div>
`;

/**
 * Generates HTML for a single transaction list item
 * 
 * Creates a clickable transaction row with checkbox (in selection mode), description,
 * amount with color coding, date, and optional badges. Supports linked transfer indicators.
 * 
 * @param {Object} params - Transaction rendering parameters
 * @param {string} params.checkboxHtml - HTML for selection checkbox (empty string if not in selection mode)
 * @param {Object} params.dataAttributes - Object containing selectionMode boolean and attrs string
 * @param {string} params.displayText - Formatted transaction description/payee text
 * @param {string} params.linkIcon - HTML for transfer link icon (empty string if not linked)
 * @param {string} params.amountSign - '+' or '-' or '' depending on transaction type
 * @param {number} params.displayAmount - Absolute amount value to display
 * @param {string} params.amountClass - CSS class for amount styling ('positive', 'negative', etc.)
 * @param {string} params.formattedDate - Human-readable date string
 * @param {string} params.dateBadges - HTML for date badges (today, yesterday, etc.)
 * @param {boolean} params.isSelected - Whether transaction is currently selected in bulk mode
 * @returns {string} HTML string for transaction list item
 * @example
 * const html = transactionItemTemplate({
 *   checkboxHtml: '<input type="checkbox" checked>',
 *   dataAttributes: { selectionMode: true, attrs: 'data-id="123"' },
 *   displayText: 'Grocery Store',
 *   linkIcon: '',
 *   amountSign: '-',
 *   displayAmount: 45.67,
 *   amountClass: 'negative',
 *   formattedDate: 'Dec 30, 2025',
 *   dateBadges: '<span class="badge">Today</span>',
 *   isSelected: true
 * });
 */
export const transactionItemTemplate = (params) => {
    const { checkboxHtml, dataAttributes, displayText, linkIcon, amountSign, displayAmount, amountClass, formattedDate, dateBadges, isSelected } = params;
    return `
        <div class="transaction-item ${dataAttributes.selectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}" ${dataAttributes.attrs}>
            ${checkboxHtml}
            <div class="transaction-content">
                <div class="transaction-header">
                    <span class="transaction-desc">${displayText}${linkIcon}</span>
                    <span class="transaction-amount ${amountClass}">
                        ${amountSign}$${displayAmount.toFixed(2)}
                    </span>
                </div>
                <div class="transaction-date">${formattedDate}${dateBadges}</div>
            </div>
        </div>
    `;
};

/**
 * Generates HTML for bulk selection toolbar with action buttons
 * 
 * Creates sticky toolbar with selection count, cancel button, select all, auto-link transfers,
 * category/payee bulk change dropdowns, and apply button. Buttons disabled when selectedCount is 0.
 * 
 * @param {number} selectedCount - Number of currently selected transactions
 * @returns {string} HTML string for bulk selection toolbar
 * @example
 * const html = selectionToolbarTemplate(5);
 * document.getElementById('toolbar-container').innerHTML = html;
 * // Dropdowns populated separately by TransactionUI
 */
export const selectionToolbarTemplate = (selectedCount) => `
    <div class="bulk-selection-toolbar" id="bulk-selection-toolbar">
        <div class="toolbar-content">
            <button class="btn-icon" id="bulk-cancel-btn" title="Cancel">
                <i data-lucide="x"></i>
            </button>
            <span class="selection-count" id="selection-count">${selectedCount} selected</span>
            <button class="btn-secondary btn-sm" id="bulk-select-all-btn">Select All Visible</button>
            <button class="btn-secondary btn-sm" id="bulk-auto-link-btn" ${selectedCount === 0 ? 'disabled' : ''}>Auto-Link Transfers</button>
            <select id="bulk-category-select" class="bulk-category-dropdown" ${selectedCount === 0 ? 'disabled' : ''}>
                <option value="">Change Category...</option>
            </select>
            <select id="bulk-payee-select" class="bulk-category-dropdown" ${selectedCount === 0 ? 'disabled' : ''}>
                <option value="">Change Payee...</option>
            </select>
            <button class="btn-primary btn-sm" id="bulk-apply-btn" ${selectedCount === 0 ? 'disabled' : ''}>Apply</button>
        </div>
    </div>
`;

/**
 * Generates HTML for transaction count header
 * 
 * Displays total transactions, visible after filters, and currently shown (if pagination active).
 * Used at top of transaction list to provide data overview.
 * 
 * @param {Object} counts - Transaction count statistics
 * @param {number} counts.total - Total number of transactions in database
 * @param {number} counts.visible - Number of transactions matching current filters
 * @param {number} counts.showing - Number of transactions currently rendered (pagination)
 * @returns {string} HTML string for count header
 * @example
 * const html = transactionCountTemplate({ total: 150, visible: 50, showing: 20 });
 * // Output: "150 transactions (50 visible, showing 20)"
 */
export const transactionCountTemplate = (counts) => `
    <div style="padding: 12px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
        <p style="margin: 0; font-weight: 600; font-size: 0.875rem;">
            <strong id="transactions-total-count">${counts.total}</strong> transactions 
            (<span id="transactions-visible-count">${counts.visible}</span> visible${counts.showing < counts.visible ? `, showing ${counts.showing}` : ''})
        </p>
    </div>
`;

/**
 * Generates HTML for "Load More" button with remaining count
 * 
 * Creates centered button showing how many additional transactions can be loaded.
 * Used in pagination when more transactions exist beyond current display limit.
 * 
 * @param {number} remaining - Number of transactions not yet displayed
 * @returns {string} HTML string for load more button
 * @example
 * const html = loadMoreButtonTemplate(30);
 * container.insertAdjacentHTML('beforeend', html);
 * // Button text: "Load More (30 more)"
 */
export const loadMoreButtonTemplate = (remaining) => `
    <div style="padding: 16px; text-align: center;">
        <button class="btn-secondary" id="load-more-transactions">
            Load More (${remaining} more)
        </button>
    </div>
`;

/**
 * Generates HTML for transaction add/edit modal form
 * 
 * Creates full modal with form fields for date, amount, description, account, category,
 * payee, transfer link, and note. Modal title and buttons change based on edit vs. create mode.
 * Delete button only shown when editing existing transaction.
 * 
 * NOTE: Category and payee dropdowns are placeholders; actual CustomSelect instances
 * are created separately by TransactionUI after modal is rendered.
 * 
 * @param {Object} [data={}] - Transaction data for pre-filling form (edit mode)
 * @param {number} [data.id] - Transaction ID (presence indicates edit mode)
 * @param {string} [data.date] - ISO date string (YYYY-MM-DD)
 * @param {number} [data.amount] - Transaction amount (signed)
 * @param {string} [data.description] - Transaction description
 * @param {string} [data.account] - Account name
 * @param {string} [data.note] - Optional note text
 * @returns {string} HTML string for transaction modal
 * @example
 * // Create mode
 * const html = transactionModalTemplate();
 * 
 * // Edit mode
 * const html = transactionModalTemplate({
 *   id: 123,
 *   date: '2025-12-30',
 *   amount: -45.67,
 *   description: 'Grocery Store',
 *   account: 'Checking',
 *   note: 'Weekly groceries'
 * });
 */
export const transactionModalTemplate = (data = {}) => {
    const isEdit = !!data.id;
    const title = isEdit ? 'Edit Transaction' : 'Add Transaction';
    
    return `
        <div id="modal" class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" id="modal-close">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="transaction-form" class="form-container">
                        <div class="input-group">
                            <label for="tx-date">Date</label>
                            <input type="date" id="tx-date" value="${data.date || ''}" required>
                        </div>
                        
                        <div class="input-group">
                            <label for="tx-amount">Amount</label>
                            <input 
                                type="number" 
                                id="tx-amount" 
                                placeholder="0.00" 
                                step="0.01" 
                                value="${data.amount || ''}" 
                                required
                            >
                        </div>
                        
                        <div class="input-group">
                            <label for="tx-description">Description</label>
                            <input 
                                type="text" 
                                id="tx-description" 
                                placeholder="Enter description" 
                                value="${data.description || ''}" 
                                required
                            >
                        </div>
                        
                        <div class="input-group">
                            <label for="tx-account">Account</label>
                            <input 
                                type="text" 
                                id="tx-account" 
                                placeholder="Enter account" 
                                value="${data.account || ''}"
                            >
                        </div>
                        
                        <div class="input-group">
                            <label for="tx-category">Category</label>
                            <div id="tx-category-container"></div>
                        </div>
                        
                        <div class="input-group">
                            <label for="tx-payee">Payee</label>
                            <div id="tx-payee-container"></div>
                        </div>
                        
                        <div class="input-group" id="tx-link-group" style="display: none;">
                            <label for="tx-link">Link Transfer</label>
                            <div id="tx-link-container"></div>
                        </div>
                        
                        <div class="input-group">
                            <label for="tx-note">Note (Optional)</label>
                            <textarea 
                                id="tx-note" 
                                placeholder="Add a note" 
                                rows="3"
                            >${data.note || ''}</textarea>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; margin-top: 24px;">
                            ${isEdit ? `
                                <button type="button" class="btn-icon-danger" id="delete-transaction">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            ` : ''}
                            <button type="button" class="btn-secondary" id="modal-cancel">Cancel</button>
                            <button type="submit" class="btn-primary">${isEdit ? 'Save' : 'Add'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
};

/**
 * Generates HTML for transfer link selection modal
 * 
 * Displays list of potential matching transfer transactions for user to select from.
 * Each option shows description, account, amount, and date. Used when linking transfers
 * to create paired transactions.
 * 
 * NOTE: After linking, both transactions will have encrypted_linkedTransactionId field
 * pointing to each other. This enables transfer detection and prevents double-counting.
 * 
 * @param {Array<Object>} matchingTransfers - Array of candidate transfer transactions
 * @param {number} matchingTransfers[].id - Transaction ID
 * @param {string} matchingTransfers[].description - Transaction description
 * @param {string} matchingTransfers[].account - Account name
 * @param {number} matchingTransfers[].amount - Transaction amount (signed)
 * @param {string} matchingTransfers[].date - ISO date string
 * @returns {string} HTML string for transfer link modal
 * @example
 * const candidates = [
 *   { id: 456, description: 'Transfer to Savings', account: 'Checking', amount: -500, date: '2025-12-30' },
 *   { id: 457, description: 'Transfer from Checking', account: 'Savings', amount: 500, date: '2025-12-30' }
 * ];
 * const html = transferLinkModalTemplate(candidates);
 */
export const transferLinkModalTemplate = (matchingTransfers) => {
    const transfersList = matchingTransfers.map(t => `
        <div class="transfer-option" data-id="${t.id}" style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px; cursor: pointer;">
            <div style="font-weight: 600;">${t.description}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px;">
                ${t.account} • $${Math.abs(t.amount).toFixed(2)} • ${new Date(t.date).toLocaleDateString()}
            </div>
        </div>
    `).join('');
    
    return `
        <div id="modal" class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Select Transfer to Link</h2>
                    <button class="modal-close" id="modal-close">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 16px; color: var(--text-secondary);">
                        Select which transfer transaction to link:
                    </p>
                    ${transfersList}
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="button" class="btn-secondary" id="modal-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

/**
 * Generates HTML for advanced filter panel
 * 
 * Creates collapsible panel with filters for category type, specific categories,
 * accounts, amount range, date range, and special conditions (unlinked transfers,
 * uncategorized). Filter values applied via FilterManager.
 * 
 * @param {Object} options - Available filter options from database
 * @param {Array<string>} options.categories - List of unique category names
 * @param {Array<string>} options.accounts - List of unique account names
 * @param {Array<string>} [options.descriptions] - List of unique descriptions (not currently used in template)
 * @returns {string} HTML string for filter panel
 * @example
 * const html = filterPanelTemplate({
 *   categories: ['Groceries', 'Gas', 'Salary'],
 *   accounts: ['Checking', 'Savings', 'Credit Card']
 * });
 * container.innerHTML = html;
 */
export const filterPanelTemplate = (options) => `
    <div id="filter-panel" class="filter-panel hidden">
        <div class="filter-section">
            <h4>Category Type</h4>
            <label><input type="checkbox" value="Income" class="filter-type"> Income</label>
            <label><input type="checkbox" value="Expense" class="filter-type"> Expense</label>
            <label><input type="checkbox" value="Transfer" class="filter-type"> Transfer</label>
            <label><input type="checkbox" value="Uncategorized" class="filter-type"> Uncategorized</label>
        </div>
        
        <div class="filter-section">
            <h4>Categories</h4>
            ${options.categories.map(cat => 
                `<label><input type="checkbox" value="${cat}" class="filter-category"> ${cat}</label>`
            ).join('')}
        </div>
        
        <div class="filter-section">
            <h4>Accounts</h4>
            ${options.accounts.map(acc => 
                `<label><input type="checkbox" value="${acc}" class="filter-account"> ${acc}</label>`
            ).join('')}
        </div>
        
        <div class="filter-section">
            <h4>Amount Range</h4>
            <div class="input-group">
                <input type="number" id="filter-amount-min" placeholder="Min" step="0.01">
                <input type="number" id="filter-amount-max" placeholder="Max" step="0.01">
            </div>
        </div>
        
        <div class="filter-section">
            <h4>Date Range</h4>
            <div class="input-group">
                <input type="date" id="filter-date-start">
                <input type="date" id="filter-date-end">
            </div>
        </div>
        
        <div class="filter-section">
            <label><input type="checkbox" id="filter-unlinked-transfers"> Unlinked Transfers Only</label>
            <label><input type="checkbox" id="filter-uncategorized"> Uncategorized Only</label>
        </div>
        
        <div class="filter-actions">
            <button class="btn-secondary" id="clear-filters">Clear Filters</button>
            <button class="btn-primary" id="apply-filters">Apply</button>
        </div>
    </div>
`;
