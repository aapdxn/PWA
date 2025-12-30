// transaction-templates.js - HTML templates for transaction UI
// Separating templates from logic for cleaner code organization

/**
 * Empty state when no transactions exist
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
 * No results when search/filter returns empty
 */
export const noResultsTemplate = () => `
    <div class="empty-state">
        <p>No transactions match your search</p>
    </div>
`;

/**
 * Transaction list item template
 * @param {Object} params - { checkboxHtml, dataAttributes, displayText, linkIcon, amountSign, displayAmount, amountClass, formattedDate, dateBadges, isSelected }
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
 * Bulk selection toolbar
 * @param {number} selectedCount - Number of selected transactions
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
 * Transaction count header
 * @param {Object} counts - { total, visible, showing }
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
 * Load more button
 * @param {number} remaining - Number of remaining items to load
 */
export const loadMoreButtonTemplate = (remaining) => `
    <div style="padding: 16px; text-align: center;">
        <button class="btn-secondary" id="load-more-transactions">
            Load More (${remaining} more)
        </button>
    </div>
`;

/**
 * Transaction modal template
 * @param {Object} data - Modal data (transaction if editing, null if creating)
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
 * Transfer link selection modal
 * @param {Array} matchingTransfers - Array of potential transfer matches
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
 * Filter panel template
 * @param {Object} options - { categories, accounts, descriptions }
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
