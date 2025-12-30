/**
 * TransactionRenderer - Transaction list rendering with caching and pagination
 * 
 * RESPONSIBILITIES:
 * - Render transaction list with pagination (50 items per page)
 * - Cache decrypted transactions for performance
 * - Apply search, filter, sort logic
 * - Merge linked transfers into single display item
 * - Generate transaction HTML from templates
 * 
 * STATE REQUIREMENTS:
 * - Requires Unlocked state (decrypts all transactions)
 * - Cache invalidation on data changes via clearCache()
 * 
 * PERFORMANCE:
 * - Caches decrypted transactions (150+ transactions = 2-3s decrypt time)
 * - Pagination prevents rendering thousands of items at once
 * - Template-based HTML generation (no direct DOM manipulation)
 * 
 * CATEGORY-AWARE AMOUNT SIGNING:
 * - Income: Always positive (green +)
 * - Expense/Saving: Always negative (red −)
 * - Transfer: Positive for merged display (green +)
 * 
 * @class TransactionRenderer
 * @module UI/Transaction
 * @layer 5 - UI Components
 */
import { decryptTransaction, formatCurrency, getAmountClass, initIcons } from '../core/ui-helpers.js';
import * as templates from '../templates/transaction-templates.js';

export class TransactionRenderer {
    /**
     * Create TransactionRenderer
     * @param {Object} deps - Dependencies { security, db, accountMappingsUI, transactionUI }
     */
    constructor(deps) {
        Object.assign(this, deps); // { security, db, accountMappingsUI }
        
        // Performance: Caching & Pagination
        this.cachedDecryptedTransactions = null;
        this.cacheTimestamp = null;
        this.itemsPerPage = 50;
        this.currentPage = 1;
        this.isLoadingMore = false;
    }
    
    /**
     * Clear decrypted transaction cache
     * CRITICAL: Call after any transaction save/delete
     * Resets pagination to page 1
     */
    clearCache() {
        this.cachedDecryptedTransactions = null;
        this.cacheTimestamp = null;
        this.currentPage = 1;
    }

    /**
     * Render transactions tab with pagination, caching, and filtering
     * @param {Object} options - { loadMore, filters, searchQuery, sortField, sortOrder, selectionMode, selectedIds }
     */
    async render(options = {}) {
        const {
            loadMore = false,
            filters = {},
            searchQuery = '',
            sortField = 'date',
            sortOrder = 'desc',
            selectionMode = false,
            selectedIds = new Set()
        } = options;
        
        console.log('📋 Rendering transactions tab', loadMore ? '(loading more)' : '');
        
        if (loadMore && this.isLoadingMore) return;
        if (loadMore) this.isLoadingMore = true;
        
        const container = document.getElementById('transactions-list');
        if (!container) {
            console.error('❌ Transactions list container not found');
            return;
        }
        
        // Fetch all transactions
        const allTransactions = await this.db.getAllTransactions();
        
        // Empty state
        if (allTransactions.length === 0) {
            container.innerHTML = templates.emptyStateTemplate();
            initIcons(container);
            return { total: 0, visible: 0, showing: 0 };
        }
        
        // Decrypt transactions with caching
        const decryptedTransactions = await this.getDecryptedTransactions(allTransactions);
        
        // Add merged names for linked transfers (for search)
        const transactionsWithMergedNames = this.addMergedDisplayNames(decryptedTransactions);
        
        // Apply search, filter, sort
        let filteredTransactions = this.applySearchFilterSort(transactionsWithMergedNames, {
            searchQuery,
            filters,
            sortField,
            sortOrder
        });
        
        // Pagination
        if (!loadMore) this.currentPage = 1;
        const totalTransactions = filteredTransactions.length;
        const endIndex = this.currentPage * this.itemsPerPage;
        const paginatedTransactions = filteredTransactions.slice(0, endIndex);
        const hasMore = endIndex < totalTransactions;
        
        // Render transaction items
        const html = this.renderTransactionItems(paginatedTransactions, decryptedTransactions, selectionMode, selectedIds);
        
        // Build final HTML
        const selectionToolbar = selectionMode ? templates.selectionToolbarTemplate(selectedIds.size) : '';
        const transactionCount = !selectionMode ? templates.transactionCountTemplate({
            total: allTransactions.length,
            visible: filteredTransactions.length,
            showing: paginatedTransactions.length
        }) : '';
        const loadMoreBtn = hasMore && !selectionMode ? templates.loadMoreButtonTemplate(
            Math.min(this.itemsPerPage, totalTransactions - paginatedTransactions.length)
        ) : '';
        
        container.innerHTML = `
            ${selectionToolbar}
            ${transactionCount}
            <div class="transactions-scroll-container ${selectionMode ? 'with-toolbar' : ''}" id="transactions-scroll-container">
                ${html || templates.noResultsTemplate()}
            </div>
            ${loadMoreBtn}
        `;
        
        this.isLoadingMore = false;
        initIcons(container);
        
        return {
            total: allTransactions.length,
            visible: filteredTransactions.length,
            showing: paginatedTransactions.length,
            hasMore,
            filteredTransactions
        };
    }

    /**
     * Get decrypted transactions with caching
     * 
     * CACHING STRATEGY:
     * 1. Check parent TransactionUI cache (from preload)
     * 2. Check local cache if lengths match
     * 3. Decrypt all transactions if cache miss
     * 
     * @param {Array} allTransactions - Raw encrypted transactions from DB
     * @returns {Promise<Array>} Decrypted transactions with resolved categories/payees
     * 
     * PERFORMANCE: 150+ transactions = 2-3 seconds decrypt time
     * STATE: Requires Unlocked (calls security.decrypt)
     */
    async getDecryptedTransactions(allTransactions) {
        // Check parent TransactionUI cache first (from preload)
        const parentCache = this.transactionUI?.cachedDecryptedTransactions;
        if (parentCache && parentCache.length === allTransactions.length) {
            console.log('✨ Using preloaded transactions');
            this.cachedDecryptedTransactions = parentCache; // Sync local cache
            return parentCache;
        }
        
        // Use local cached decrypted transactions if available and data hasn't changed
        if (this.cachedDecryptedTransactions && allTransactions.length === this.cachedDecryptedTransactions.length) {
            console.log('✨ Using cached transactions');
            return this.cachedDecryptedTransactions;
        }
        
        console.log('🔄 Decrypting transactions...');
        
        // STATE GUARD: Decrypt requires unlocked state
        // Fetch all related data
        const categories = await this.db.getAllCategories();
        const payees = await this.db.getAllPayees();
        const mappings = await this.db.getAllMappingsDescriptions();
        
        // Decrypt all transactions
        const decryptedTransactions = await Promise.all(
            allTransactions.map(t => decryptTransaction(t, {
                security: this.security,
                categories,
                payees,
                mappings,
                accountMappingsUI: this.accountMappingsUI
            }))
        );
        
        // Cache the results
        this.cachedDecryptedTransactions = decryptedTransactions;
        this.cacheTimestamp = Date.now();
        
        return decryptedTransactions;
    }

    /**
     * Add merged display names for linked transfers
     * Enables search of "Transfer from X to Y" format
     * 
     * @param {Array} transactions - Decrypted transactions
     * @returns {Array} Transactions with mergedDisplayName property
     * 
     * EXAMPLE: "Transfer from Checking to Savings"
     */
    addMergedDisplayNames(transactions) {
        return transactions.map(t => {
            if (t.categoryType === 'Transfer' && t.linkedTransactionId) {
                const linkedTx = transactions.find(tx => tx.id === t.linkedTransactionId);
                if (linkedTx) {
                    const fromAccount = t.amount < 0 ? t.accountDisplayName : linkedTx.accountDisplayName;
                    const toAccount = t.amount > 0 ? t.accountDisplayName : linkedTx.accountDisplayName;
                    return { ...t, mergedDisplayName: `Transfer from ${fromAccount} to ${toAccount}` };
                }
            }
            return { ...t, mergedDisplayName: null };
        });
    }

    /**
     * Apply search, filter, and sort to transactions
     * 
     * @param {Array} transactions - Decrypted transactions
     * @param {Object} options - { searchQuery, filters, sortField, sortOrder }
     * @returns {Array} Filtered and sorted transactions
     * 
     * FILTERS:
     * - categories, types, accounts, descriptions
     * - amountMin, amountMax (absolute values)
     * - dateStart, dateEnd
     * - unlinkedTransfersOnly, uncategorizedOnly
     * 
     * SORT FIELDS: date, amount, description, account, category
     */
    applySearchFilterSort(transactions, options) {
        const { searchQuery, filters, sortField, sortOrder } = options;
        let filtered = [...transactions];
        
        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const searchFields = ['description', 'account', 'accountDisplayName', 'categoryName', 'payeeName'];
            
            filtered = filtered.filter(t => {
                // Check merged display name first for linked transfers
                if (t.mergedDisplayName && t.mergedDisplayName.toLowerCase().includes(query)) {
                    return true;
                }
                // Then check regular search fields
                return searchFields.some(field => {
                    const value = (t[field] || '').toString().toLowerCase();
                    return value.includes(query);
                });
            });
        }
        
        // Apply filters
        if (filters.categories && filters.categories.length > 0) {
            filtered = filtered.filter(t => filters.categories.includes(t.categoryName));
        }
        if (filters.types && filters.types.length > 0) {
            filtered = filtered.filter(t => filters.types.includes(t.categoryType));
        }
        if (filters.accounts && filters.accounts.length > 0) {
            filtered = filtered.filter(t => filters.accounts.includes(t.accountDisplayName));
        }
        if (filters.descriptions && filters.descriptions.length > 0) {
            filtered = filtered.filter(t => filters.descriptions.includes(t.description));
        }
        if (filters.amountMin !== null && filters.amountMin !== undefined) {
            filtered = filtered.filter(t => Math.abs(t.amount) >= filters.amountMin);
        }
        if (filters.amountMax !== null && filters.amountMax !== undefined) {
            filtered = filtered.filter(t => Math.abs(t.amount) <= filters.amountMax);
        }
        if (filters.dateStart) {
            const startDate = new Date(filters.dateStart);
            startDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(t => {
                const transDate = new Date(t.date);
                transDate.setHours(0, 0, 0, 0);
                return transDate >= startDate;
            });
        }
        if (filters.dateEnd) {
            const endDate = new Date(filters.dateEnd);
            endDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => {
                const transDate = new Date(t.date);
                return transDate <= endDate;
            });
        }
        if (filters.unlinkedTransfersOnly) {
            filtered = filtered.filter(t => t.categoryType === 'Transfer' && !t.linkedTransactionId);
        }
        if (filters.uncategorizedOnly) {
            filtered = filtered.filter(t => t.categoryType === 'Uncategorized');
        }
        
        // Apply sort
        filtered.sort((a, b) => {
            let aVal, bVal;
            
            if (sortField === 'amount') {
                aVal = Math.abs(a.amount);
                bVal = Math.abs(b.amount);
            } else if (sortField === 'date') {
                aVal = new Date(a.date);
                bVal = new Date(b.date);
            } else {
                aVal = (a[sortField] || '').toString().toLowerCase();
                bVal = (b[sortField] || '').toString().toLowerCase();
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return filtered;
    }

    /**
     * Render individual transaction items with merged transfer display
     * 
     * @param {Array} paginatedTransactions - Transactions to display (current page)
     * @param {Array} allDecryptedTransactions - All decrypted (for linked transfer lookup)
     * @param {boolean} selectionMode - Show checkboxes if true
     * @param {Set} selectedIds - Currently selected transaction IDs
     * @returns {string} HTML string
     * 
     * MERGED TRANSFER DISPLAY:
     * - Linked transfers shown as single item: "Transfer from X to Y"
     * - Always positive amount (green)
     * - Both transaction IDs tracked in data attributes
     * - Prevents duplicate display of linked transaction
     * 
     * CATEGORY-AWARE AMOUNT SIGNING:
     * - Uses getAmountClass() for color (Income=green, Expense=red)
     * - Sign indicator: + or −
     */
    renderTransactionItems(paginatedTransactions, allDecryptedTransactions, selectionMode, selectedIds) {
        // Track which transactions have been displayed as part of a merged transfer
        const displayedAsLinkedTransfer = new Set();
        
        let html = '';
        for (const t of paginatedTransactions) {
            // Skip if already displayed as part of a linked transfer
            if (displayedAsLinkedTransfer.has(t.id)) {
                continue;
            }
            
            const isTransfer = t.categoryType === 'Transfer';
            const isUncategorized = t.categoryType === 'Uncategorized';
            const isLinkedTransfer = isTransfer && t.linkedTransactionId;
            
            let displayText, displayAmount, amountClass, dateBadges, formattedDate, linkIcon;
            let dataIds = [t.id]; // Track all transaction IDs for this display item
            
            // Handle linked transfers - merge into single display
            if (isLinkedTransfer) {
                const linkedTx = allDecryptedTransactions.find(tx => tx.id === t.linkedTransactionId);
                
                if (linkedTx) {
                    // Mark linked transaction as displayed
                    displayedAsLinkedTransfer.add(linkedTx.id);
                    dataIds.push(linkedTx.id);
                    
                    // Determine from/to accounts based on which has negative amount
                    const fromAccount = t.amount < 0 ? t.accountDisplayName : linkedTx.accountDisplayName;
                    const toAccount = t.amount > 0 ? t.accountDisplayName : linkedTx.accountDisplayName;
                    
                    displayText = `Transfer from ${fromAccount} to ${toAccount}`;
                    displayAmount = Math.abs(t.amount);
                    amountClass = 'income'; // Always show as positive (green)
                    
                    // Use earlier date
                    const date1 = new Date(t.date);
                    const date2 = new Date(linkedTx.date);
                    const earlierDate = date1 < date2 ? date1 : date2;
                    formattedDate = earlierDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                    
                    // Transfer badge only
                    dateBadges = '<span class="badge badge-category-transfer">Transfer</span>';
                    linkIcon = '<i data-lucide="link" style="width: 14px; height: 14px; margin-left: 4px; vertical-align: middle;"></i>';
                } else {
                    // Linked transaction not found (fallback)
                    displayText = t.payeeName || t.description;
                    displayAmount = Math.abs(t.amount);
                    amountClass = getAmountClass(t.amount, t.categoryType);
                    
                    const dateObj = new Date(t.date);
                    formattedDate = dateObj.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                    
                    linkIcon = '<i data-lucide="link" style="width: 14px; height: 14px; margin-left: 4px; vertical-align: middle;"></i>';
                    dateBadges = this.buildDateBadges(t);
                }
            } else {
                // Normal transaction or unlinked transfer
                // For unlinked transfers, always show description even if payee exists
                displayText = (isTransfer && !isLinkedTransfer) ? t.description : (t.payeeName || t.description);
                displayAmount = Math.abs(t.amount);
                amountClass = getAmountClass(t.amount, t.categoryType);
                
                const dateObj = new Date(t.date);
                formattedDate = dateObj.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
                
                linkIcon = '';
                dateBadges = this.buildDateBadges(t);
            }
            
            const isSelected = dataIds.some(id => selectedIds.has(id));
            const checkboxHtml = selectionMode ? 
                `<input type="checkbox" class="transaction-checkbox" data-id="${t.id}" data-linked-id="${dataIds.length > 1 ? dataIds[1] : ''}" ${isSelected ? 'checked' : ''}>` : 
                '';
            
            // Determine the sign based on the original amount
            const amountSign = (isLinkedTransfer || t.amount >= 0) ? '+' : '-';
            
            html += templates.transactionItemTemplate({
                checkboxHtml,
                dataAttributes: {
                    selectionMode,
                    attrs: `data-id="${t.id}" data-linked-id="${dataIds.length > 1 ? dataIds[1] : ''}" data-is-merged="${dataIds.length > 1}"`
                },
                displayText,
                linkIcon,
                amountSign,
                displayAmount,
                amountClass,
                formattedDate,
                dateBadges,
                isSelected
            });
        }
        
        return html;
    }

    /**
     * Build category and account badges for transaction display
     * 
     * @param {Object} t - Decrypted transaction
     * @returns {string} HTML badges
     * 
     * BADGE COLORS:
     * - Income: Green
     * - Expense: Red
     * - Transfer: Blue
     * - Saving: Orange
     * - Uncategorized: Gray
     */
    buildDateBadges(t) {
        let dateBadges = '';
        
        // Always show payee if it exists
        if (t.payeeName) {
            const isUncategorized = t.categoryType === 'Uncategorized';
            // Category badge (with type-based color)
            if (isUncategorized) {
                dateBadges += `<span class="badge badge-uncategorized">Uncategorized</span>`;
            } else if (t.categoryName) {
                const categoryClass = t.categoryType === 'Income' ? 'badge-category-income' : 
                                     t.categoryType === 'Transfer' ? 'badge-category-transfer' : 
                                     t.categoryType === 'Saving' ? 'badge-category-saving' :
                                     'badge-category-expense';
                dateBadges += `<span class="badge ${categoryClass}">${t.categoryName}</span>`;
            }
        }
        
        // Always show account badge when account display name exists
        if (t.accountDisplayName) {
            dateBadges += `<span class="badge badge-account">${t.accountDisplayName}</span>`;
        }
        
        return dateBadges;
    }
}
