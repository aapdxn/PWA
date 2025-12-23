// TransactionUI - Handles transaction display, forms, and CRUD operations
export class TransactionUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
        
        // Undo/Redo history
        this.undoStack = [];
        this.redoStack = [];
        
        // Search/Filter/Sort state
        this.searchQuery = '';
        this.searchFields = ['description'];
        this.sortField = 'date';
        this.sortOrder = 'desc';
        this.filters = {
            categories: [],
            accounts: [],
            descriptions: [],
            amountMin: null,
            amountMax: null,
            dateStart: null,
            dateEnd: null
        };
        
        // CSV Import Search/Filter state
        this.csvSearchQuery = '';
        this.csvFilterDuplicates = false;
        this.csvFilterUnmapped = false;
        this.csvFilterAuto = false;
    }

    async renderTransactionsTab() {
        console.log('📋 Rendering transactions tab');
        
        const allTransactions = await this.db.getAllTransactions();
        const container = document.getElementById('transactions-list');
        
        if (!container) {
            console.error('❌ Transactions list container not found');
            return;
        }
        
        if (allTransactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="inbox" style="width: 64px; height: 64px;"></i>
                    </div>
                    <h3>No Transactions Yet</h3>
                    <p>Use the + button below to get started</p>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Decrypt all transactions with full data
        const categories = await this.db.getAllCategories();
        const decryptedTransactions = await Promise.all(
            allTransactions.map(async (t) => ({
                id: t.id,
                date: await this.security.decrypt(t.encrypted_date),
                amount: parseFloat(await this.security.decrypt(t.encrypted_amount)),
                description: t.encrypted_description ? await this.security.decrypt(t.encrypted_description) : 'No description',
                account: t.encrypted_account ? await this.security.decrypt(t.encrypted_account) : '',
                note: t.encrypted_note ? await this.security.decrypt(t.encrypted_note) : '',
                categoryId: t.categoryId,
                categoryName: await this.getCategoryName(t.categoryId, categories)
            }))
        );
        
        // Apply search, filter, and sort
        let filteredTransactions = this.applySearchFilterSort(decryptedTransactions);
        
        let html = '';
        for (const t of filteredTransactions) {
            const amountClass = t.amount >= 0 ? 'income' : 'expense';
            const displayAmount = Math.abs(t.amount);
            const dateObj = new Date(t.date);
            const formattedDate = dateObj.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            
            html += `
                <div class="transaction-item" data-id="${t.id}">
                    <div class="transaction-header">
                        <span class="transaction-desc">${t.description}</span>
                        <span class="transaction-amount ${amountClass}">
                            ${t.amount >= 0 ? '+' : '-'}$${displayAmount.toFixed(2)}
                        </span>
                    </div>
                    <div class="transaction-date">${formattedDate}</div>
                </div>
            `;
        }
        
        container.innerHTML = html || '<div class="empty-state"><p>No transactions match your search</p></div>';
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async openTransactionModal(transactionId = null) {
        console.log('💵 Opening transaction modal, ID:', transactionId);
        
        const modal = document.getElementById('transaction-modal');
        const form = document.getElementById('transaction-form');
        
        if (!modal) {
            console.error('❌ Transaction modal not found!');
            return;
        }
        
        await this.populateCategorySelect();
        
        if (transactionId) {
            const transactions = await this.db.getAllTransactions();
            const transaction = transactions.find(t => t.id === transactionId);
            
            if (!transaction) {
                alert('Transaction not found');
                return;
            }
            
            const date = await this.security.decrypt(transaction.encrypted_date);
            const amount = Math.abs(parseFloat(await this.security.decrypt(transaction.encrypted_amount)));
            const description = transaction.encrypted_description 
                ? await this.security.decrypt(transaction.encrypted_description) 
                : '';
            const account = transaction.encrypted_account 
                ? await this.security.decrypt(transaction.encrypted_account) 
                : '';
            const note = transaction.encrypted_note 
                ? await this.security.decrypt(transaction.encrypted_note) 
                : '';
            
            document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
            // Convert date to YYYY-MM-DD format for date input
            const dateForInput = this.formatDateForInput(date);
            document.getElementById('transaction-date').value = dateForInput;
            document.getElementById('transaction-amount').value = amount;
            document.getElementById('transaction-description').value = description;
            document.getElementById('transaction-account').value = account;
            document.getElementById('transaction-category').value = transaction.categoryId || '';
            document.getElementById('transaction-note').value = note;
            
            form.dataset.editId = transactionId;
            
            let deleteBtn = document.getElementById('delete-transaction-btn');
            if (!deleteBtn) {
                deleteBtn = document.createElement('button');
                deleteBtn.id = 'delete-transaction-btn';
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-icon-danger';
                deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
                deleteBtn.title = 'Delete';
                const modalActions = form.querySelector('.modal-actions');
                if (modalActions) {
                    modalActions.insertBefore(deleteBtn, modalActions.firstChild);
                }
            }
            deleteBtn.classList.remove('hidden');
            
            const saveBtn = document.getElementById('transaction-form-submit');
            if (saveBtn) {
                saveBtn.innerHTML = '<i data-lucide="check"></i>';
                saveBtn.title = 'Save';
            }
        } else {
            document.getElementById('transaction-modal-title').textContent = 'Add Transaction';
            form.reset();
            
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('transaction-date').value = today;
            
            delete form.dataset.editId;
            
            const deleteBtn = document.getElementById('delete-transaction-btn');
            if (deleteBtn) {
                deleteBtn.classList.add('hidden');
            }
            
            const saveBtn = document.getElementById('transaction-form-submit');
            if (saveBtn) {
                saveBtn.innerHTML = 'Save';
                saveBtn.title = '';
            }
        }
        
        modal.classList.remove('hidden');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async populateCategorySelect() {
        const select = document.getElementById('transaction-category');
        if (!select) return;
        
        const categories = await this.db.getAllCategories();
        
        let html = '<option value="">Select category...</option>';
        
        const grouped = { Income: [], Expense: [], Saving: [], Transfer: [] };
        for (const cat of categories) {
            const name = await this.security.decrypt(cat.encrypted_name);
            grouped[cat.type || 'Expense'].push({ id: cat.id, name });
        }
        
        for (const type of ['Income', 'Expense', 'Saving', 'Transfer']) {
            if (grouped[type].length === 0) continue;
            
            html += `<optgroup label="${type}">`;
            grouped[type].forEach(cat => {
                html += `<option value="${cat.id}">${cat.name}</option>`;
            });
            html += `</optgroup>`;
        }
        
        select.innerHTML = html;
    }

    async saveTransaction(onSuccess) {
        console.log('💾 Saving transaction...');
        
        const form = document.getElementById('transaction-form');
        const date = document.getElementById('transaction-date').value;
        const amount = document.getElementById('transaction-amount').value;
        const categoryId = parseInt(document.getElementById('transaction-category').value);
        const description = document.getElementById('transaction-description').value.trim();
        const account = document.getElementById('transaction-account').value.trim();
        const note = document.getElementById('transaction-note').value.trim();
        
        if (!date || !amount || !categoryId) {
            alert('Please fill in Date, Amount, and Category');
            return;
        }
        
        try {
            const category = await this.db.getCategory(categoryId);
            const categoryType = category.type || 'Expense';
            
            let signedAmount = parseFloat(amount);
            if (categoryType === 'Income') {
                signedAmount = Math.abs(signedAmount);
            } else if (categoryType === 'Expense' || categoryType === 'Saving') {
                signedAmount = -Math.abs(signedAmount);
            }
            
            const transaction = {
                encrypted_date: await this.security.encrypt(date),
                encrypted_amount: await this.security.encrypt(signedAmount.toString()),
                encrypted_description: description ? await this.security.encrypt(description) : '',
                encrypted_account: account ? await this.security.encrypt(account) : '',
                encrypted_note: note ? await this.security.encrypt(note) : '',
                categoryId: categoryId
            };
            
            if (form.dataset.editId) {
                transaction.id = parseInt(form.dataset.editId);
            }
            
            const transactionId = await this.db.saveTransaction(transaction);
            
            // Track new additions for undo
            if (!form.dataset.editId && transactionId) {
                this.addToUndoStack(transactionId);
            }
            
            document.getElementById('transaction-modal').classList.add('hidden');
            
            if (onSuccess) {
                await onSuccess();
            }
            
            console.log('✅ Transaction saved successfully');
        } catch (error) {
            console.error('❌ Save transaction failed:', error);
            alert('Failed to save transaction: ' + error.message);
        }
    }

    async deleteTransaction(transactionId, onSuccess) {
        console.log('🗑️ Deleting transaction:', transactionId);
        
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }
        
        try {
            await this.db.deleteTransaction(transactionId);
            document.getElementById('transaction-modal').classList.add('hidden');
            
            if (onSuccess) {
                await onSuccess();
            }
            
            console.log('✅ Transaction deleted');
        } catch (error) {
            console.error('❌ Delete transaction failed:', error);
            alert('Failed to delete transaction: ' + error.message);
        }
    }

    async getCategoryName(categoryId, categories) {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return '';
        return await this.security.decrypt(category.encrypted_name);
    }

    applySearchFilterSort(transactions) {
        let filtered = [...transactions];
        
        // Apply search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(t => {
                return this.searchFields.some(field => {
                    const value = (t[field] || '').toString().toLowerCase();
                    return value.includes(query);
                });
            });
        }
        
        // Apply filters
        if (this.filters.categories.length > 0) {
            filtered = filtered.filter(t => this.filters.categories.includes(t.categoryName));
        }
        if (this.filters.accounts.length > 0) {
            filtered = filtered.filter(t => this.filters.accounts.includes(t.account));
        }
        if (this.filters.descriptions.length > 0) {
            filtered = filtered.filter(t => this.filters.descriptions.includes(t.description));
        }
        if (this.filters.amountMin !== null) {
            filtered = filtered.filter(t => Math.abs(t.amount) >= this.filters.amountMin);
        }
        if (this.filters.amountMax !== null) {
            filtered = filtered.filter(t => Math.abs(t.amount) <= this.filters.amountMax);
        }
        if (this.filters.dateStart) {
            filtered = filtered.filter(t => new Date(t.date) >= new Date(this.filters.dateStart));
        }
        if (this.filters.dateEnd) {
            filtered = filtered.filter(t => new Date(t.date) <= new Date(this.filters.dateEnd));
        }
        
        // Apply sort
        filtered.sort((a, b) => {
            let aVal, bVal;
            
            if (this.sortField === 'amount') {
                aVal = Math.abs(a.amount);
                bVal = Math.abs(b.amount);
            } else if (this.sortField === 'date') {
                aVal = new Date(a.date);
                bVal = new Date(b.date);
            } else {
                aVal = (a[this.sortField] || '').toString().toLowerCase();
                bVal = (b[this.sortField] || '').toString().toLowerCase();
            }
            
            if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return filtered;
    }

    async populateFilterOptions() {
        const transactions = await this.db.getAllTransactions();
        const categories = await this.db.getAllCategories();
        
        const uniqueCategories = new Set();
        const uniqueAccounts = new Set();
        const uniqueDescriptions = new Set();
        
        for (const t of transactions) {
            if (t.categoryId) {
                const catName = await this.getCategoryName(t.categoryId, categories);
                if (catName) uniqueCategories.add(catName);
            }
            if (t.encrypted_account) {
                const account = await this.security.decrypt(t.encrypted_account);
                if (account) uniqueAccounts.add(account);
            }
            if (t.encrypted_description) {
                const desc = await this.security.decrypt(t.encrypted_description);
                if (desc) uniqueDescriptions.add(desc);
            }
        }
        
        this.populateSelect('filter-category', Array.from(uniqueCategories).sort());
        this.populateSelect('filter-account', Array.from(uniqueAccounts).sort());
        this.populateSelect('filter-description', Array.from(uniqueDescriptions).sort());
    }

    populateSelect(selectId, options) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        select.innerHTML = options.map(opt => 
            `<option value="${opt}">${opt}</option>`
        ).join('');
    }

    filterSelectOptions(selectId, searchId) {
        const search = document.getElementById(searchId);
        const select = document.getElementById(selectId);
        if (!search || !select) return;
        
        const query = search.value.toLowerCase();
        Array.from(select.options).forEach(option => {
            const text = option.text.toLowerCase();
            option.style.display = text.includes(query) ? '' : 'none';
        });
    }

    addToUndoStack(transactionId) {
        this.undoStack.push(transactionId);
        this.redoStack = []; // Clear redo stack when new action is performed
        this.updateUndoRedoButtons();
    }

    async undoLastAdd() {
        if (this.undoStack.length === 0) return;
        
        const transactionId = this.undoStack.pop();
        try {
            // Fetch the transaction data before deleting
            const transaction = await this.db.getTransaction(transactionId);
            if (!transaction) {
                console.error('Transaction not found for undo');
                return false;
            }
            
            // Delete the transaction
            await this.db.deleteTransaction(transactionId);
            
            // Store the transaction data (without ID) in redo stack
            const { id, ...transactionData } = transaction;
            this.redoStack.push(transactionData);
            
            this.updateUndoRedoButtons();
            return true;
        } catch (error) {
            console.error('Undo failed:', error);
            this.undoStack.push(transactionId); // Restore to undo stack
            return false;
        }
    }

    async redoLastAdd() {
        if (this.redoStack.length === 0) return;
        
        const transactionData = this.redoStack.pop();
        try {
            // Re-add the transaction (will get a new ID)
            const newId = await this.db.saveTransaction(transactionData);
            
            // Add new ID to undo stack
            this.undoStack.push(newId);
            
            this.updateUndoRedoButtons();
            return true;
        } catch (error) {
            console.error('Redo failed:', error);
            this.redoStack.push(transactionData); // Restore to redo stack
            return false;
        }
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('fab-undo');
        const redoBtn = document.getElementById('fab-redo');
        
        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
        }
        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
        }
    }

    /**
     * Format date string to YYYY-MM-DD for date input
     */
    formatDateForInput(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString; // Return as-is if invalid
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return dateString; // Return as-is on error
        }
    }

    /**
     * Open CSV Import Review Page
     * Shows processed transactions for user review before import
     */
    async openCSVReviewModal(processedData, csvEngine) {
        const allCategories = await this.db.getAllCategories();
        
        // Track mappings set during this import session
        this.importSessionMappings = {};
        
        // Build page HTML
        const pageHTML = `
            <div style="padding: 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <p style="margin: 0; font-weight: 600;"><strong id="csv-total-count">${processedData.length}</strong> transactions (<span id="csv-visible-count">${processedData.length}</span> visible)</p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">Set mappings for each description - once set, they'll auto-apply to matching transactions in this import</p>
            </div>
            
            <!-- Search and Filter -->
            <div class="csv-search-filter" style="padding: 1rem; background: var(--bg-primary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <div class="search-bar" style="margin-bottom: 0.75rem;">
                    <div class="search-input-wrapper">
                        <i data-lucide="search"></i>
                        <input type="text" id="csv-search-input" placeholder="Search descriptions..." />
                    </div>
                    <button class="search-menu-btn" id="csv-advanced-search-toggle">
                        <i data-lucide="sliders-horizontal"></i>
                    </button>
                </div>
                
                <!-- Advanced Search/Filter Panel -->
                <div class="advanced-search-panel hidden" id="csv-advanced-search-panel" style="position: relative; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; margin-top: 0.75rem; max-height: 60vh; overflow: hidden; display: flex; flex-direction: column;">
                    <div class="advanced-scroll-container" style="flex: 1; overflow-y: auto; padding: 1rem;">
                        <div class="advanced-section">
                            <h4 class="section-toggle csv-section-toggle">
                                <span>Quick Filters</span>
                                <i data-lucide="chevron-down"></i>
                            </h4>
                            <div class="advanced-section-content">
                                <div class="checkbox-group">
                                    <label><input type="checkbox" id="csv-filter-duplicates"> Hide Duplicates</label>
                                    <label><input type="checkbox" id="csv-filter-unmapped"> Show Only Unmapped</label>
                                    <label><input type="checkbox" id="csv-filter-auto"> Show Only Auto-Mapped</label>
                                </div>
                            </div>
                        </div>
                        
                        <div class="advanced-section">
                            <h4 class="section-toggle csv-section-toggle">
                                <span>Sort By</span>
                                <i data-lucide="chevron-down"></i>
                            </h4>
                            <div class="advanced-section-content">
                                <select id="csv-sort-field">
                                    <option value="date">Date</option>
                                    <option value="amount">Amount</option>
                                    <option value="description">Description</option>
                                    <option value="account">Account</option>
                                </select>
                                <select id="csv-sort-order">
                                    <option value="desc">Descending</option>
                                    <option value="asc">Ascending</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="advanced-section">
                            <h4 class="section-toggle csv-section-toggle collapsed">
                                <span>Filter by Amount</span>
                                <i data-lucide="chevron-down"></i>
                            </h4>
                            <div class="advanced-section-content collapsed">
                                <div class="filter-group">
                                    <div class="range-inputs">
                                        <input type="number" id="csv-filter-amount-min" placeholder="Min" step="0.01" />
                                        <span>to</span>
                                        <input type="number" id="csv-filter-amount-max" placeholder="Max" step="0.01" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="advanced-section">
                            <h4 class="section-toggle csv-section-toggle collapsed">
                                <span>Filter by Date</span>
                                <i data-lucide="chevron-down"></i>
                            </h4>
                            <div class="advanced-section-content collapsed">
                                <div class="filter-group">
                                    <div class="range-inputs">
                                        <input type="date" id="csv-filter-date-start" />
                                        <span>to</span>
                                        <input type="date" id="csv-filter-date-end" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="advanced-actions" style="flex-shrink: 0; padding: 1rem; border-top: 1px solid var(--border-color); background: var(--bg-primary);">
                        <button class="btn-secondary" id="csv-clear-filters">Clear All</button>
                        <button class="btn-primary" id="csv-apply-filters">Apply</button>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.75rem;">
                    <button class="btn-secondary" id="csv-skip-all" style="width: auto; padding: 0.5rem 1rem; font-size: 0.875rem; margin-left: auto;">
                        <i data-lucide="x-circle"></i>
                        Skip All Visible
                    </button>
                </div>
            </div>
            
            <div id="csv-review-list" style="flex: 1; overflow-y: auto; padding: 1rem;">
                ${await this.buildCSVReviewList(processedData, allCategories)}
            </div>
            
            <div style="display: flex; gap: 1rem; padding: 1rem; background: var(--bg-secondary); border-top: 1px solid var(--border-color); flex-shrink: 0;">
                <button class="btn btn-secondary" id="csv-review-cancel" style="flex: 1;">Cancel</button>
                <button class="btn btn-primary" id="csv-review-import" style="flex: 1;">Import Selected</button>
            </div>
        `;
        
        // Insert into CSV import page
        const csvPage = document.getElementById('csv-import-page');
        const csvContent = document.getElementById('csv-import-content');
        if (!csvPage || !csvContent) {
            console.error('CSV import page not found');
            return;
        }
        
        csvContent.innerHTML = pageHTML;
        
        // Save the current tab so we can return to it when closing
        if (this.uiManager) {
            this.previousTab = this.uiManager.currentTab || 'transactions';
        }
        
        // Show CSV import page, hide others (use active class like normal tabs)
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        csvPage.classList.remove('hidden');
        csvPage.classList.add('active');
        
        // Hide bottom navigation and FAB
        const bottomNav = document.querySelector('.bottom-nav');
        const fab = document.querySelector('.fab');
        if (bottomNav) bottomNav.style.display = 'none';
        if (fab) fab.classList.add('hidden');
        
        // Get page reference for event listeners
        const modal = csvPage; // Use same variable name for compatibility
        
        // Back button handler
        document.getElementById('csv-import-back').addEventListener('click', () => {
            this.closeCSVImportPage();
        });
        
        // Close/Cancel handlers
        document.getElementById('csv-review-cancel').addEventListener('click', () => {
            this.closeCSVImportPage();
        });
        
        // Import handler
        document.getElementById('csv-review-import').addEventListener('click', async () => {
            await this.handleCSVImport(processedData, csvEngine);
            this.closeCSVImportPage();
        });
        
        // Advanced search toggle
        document.getElementById('csv-advanced-search-toggle').addEventListener('click', () => {
            const panel = document.getElementById('csv-advanced-search-panel');
            panel.classList.toggle('hidden');
        });
        
        // Section toggle handlers (collapsible sections)
        modal.querySelectorAll('.csv-section-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('collapsed');
                const content = toggle.nextElementSibling;
                if (content) {
                    content.classList.toggle('collapsed');
                }
                // Re-initialize Lucide icons
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        });
        
        // Search handler
        document.getElementById('csv-search-input').addEventListener('input', (e) => {
            this.csvSearchQuery = e.target.value;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Quick filter handlers
        document.getElementById('csv-filter-duplicates').addEventListener('change', (e) => {
            this.csvFilterDuplicates = e.target.checked;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-unmapped').addEventListener('change', (e) => {
            this.csvFilterUnmapped = e.target.checked;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-auto').addEventListener('change', (e) => {
            this.csvFilterAuto = e.target.checked;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Advanced filter handlers
        document.getElementById('csv-filter-amount-min').addEventListener('change', () => {
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-amount-max').addEventListener('change', () => {
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-date-start').addEventListener('change', () => {
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-date-end').addEventListener('change', () => {
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Sort handlers
        document.getElementById('csv-sort-field').addEventListener('change', () => {
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-sort-order').addEventListener('change', () => {
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Clear filters
        document.getElementById('csv-clear-filters').addEventListener('click', () => {
            this.csvSearchQuery = '';
            this.csvFilterDuplicates = false;
            this.csvFilterUnmapped = false;
            this.csvFilterAuto = false;
            
            document.getElementById('csv-search-input').value = '';
            document.getElementById('csv-filter-duplicates').checked = false;
            document.getElementById('csv-filter-unmapped').checked = false;
            document.getElementById('csv-filter-auto').checked = false;
            document.getElementById('csv-filter-amount-min').value = '';
            document.getElementById('csv-filter-amount-max').value = '';
            document.getElementById('csv-filter-date-start').value = '';
            document.getElementById('csv-filter-date-end').value = '';
            document.getElementById('csv-sort-field').value = 'date';
            document.getElementById('csv-sort-order').value = 'desc';
            
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Apply filters (same as clear in this case since filters are real-time)
        document.getElementById('csv-apply-filters').addEventListener('click', () => {
            const panel = document.getElementById('csv-advanced-search-panel');
            panel.classList.add('hidden');
        });
        
        // Skip All handler
        document.getElementById('csv-skip-all').addEventListener('click', () => {
            this.skipAllVisibleCSVItems(modal, processedData);
        });
        
        // Skip checkbox handlers
        modal.querySelectorAll('.csv-skip-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (processedData[index]) {
                    processedData[index].skip = e.target.checked;
                }
            });
        });
        
        // Attach review list-specific listeners
        this.attachCSVReviewListeners(modal, processedData, csvEngine, allCategories);
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Attach event listeners to CSV review list items (radio buttons, dropdowns, save buttons)
     * This is separated so it can be called after rebuilding the list
     */
    attachCSVReviewListeners(modal, processedData, csvEngine, allCategories) {
        // Mapping type change handlers (Auto/Manual toggle)
        modal.querySelectorAll('.csv-mapping-type').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const item = processedData[index];
                const itemElement = modal.querySelector(`[data-item-index="${index}"]`);
                const categorySelect = itemElement.querySelector('.csv-category-select');
                const saveButton = itemElement.querySelector('.csv-save-mapping');
                
                if (e.target.value === 'auto') {
                    // Auto mode: check if mapping exists for this description
                    const hasMapping = this.importSessionMappings[item.description] !== undefined;
                    if (hasMapping) {
                        // Mapping exists - disable dropdown, hide save button
                        categorySelect.disabled = true;
                        if (saveButton) saveButton.classList.add('hidden');
                    } else {
                        // No mapping - enable dropdown, show save button
                        categorySelect.disabled = false;
                        if (saveButton) saveButton.classList.remove('hidden');
                    }
                } else {
                    // Manual mode - always enable dropdown, hide save button
                    categorySelect.disabled = false;
                    if (saveButton) saveButton.classList.add('hidden');
                }
            });
        });
        
        // Save mapping button handlers (for Auto mode without existing mapping)
        modal.querySelectorAll('.csv-save-mapping').forEach(button => {
            button.addEventListener('click', async (e) => {
                const index = parseInt(e.target.closest('[data-index]').dataset.index);
                const item = processedData[index];
                
                // Find the category select in the same item
                const itemElement = e.target.closest('.csv-review-item');
                const categorySelect = itemElement?.querySelector('.csv-category-select');
                
                if (!categorySelect) {
                    console.error('Category select not found');
                    return;
                }
                
                const categoryId = parseInt(categorySelect.value);
                
                if (!categoryId) {
                    alert('Please select a category first');
                    return;
                }
                
                // Save mapping for this description
                this.importSessionMappings[item.description] = categoryId;
                
                // Rebuild the entire list to apply the new mapping
                const reviewList = document.getElementById('csv-review-list');
                reviewList.innerHTML = await this.buildCSVReviewList(processedData, allCategories);
                
                // Re-apply current filters and sorting
                this.applyCSVFiltersAndSort(modal, processedData);
                
                // Re-attach all event listeners
                this.attachCSVReviewListeners(modal, processedData, csvEngine, allCategories);
                
                // Re-initialize Lucide icons after everything is done
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        });
        
        // Category change handlers (only updates current item)
        modal.querySelectorAll('.csv-category-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const categoryId = parseInt(e.target.value);
                const item = processedData[index];
                
                if (item) {
                    item.categoryId = categoryId;
                }
            });
        });
        
        // Skip checkbox handlers
        modal.querySelectorAll('.csv-skip-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (processedData[index]) {
                    processedData[index].skip = e.target.checked;
                }
            });
        });
    }

    /**
     * Build HTML list of CSV transactions for review
     */
    async buildCSVReviewList(processedData, allCategories) {
        let html = '<div class="csv-review-items">';
        
        // Decrypt category names for display
        const categoryNames = {};
        for (const cat of allCategories) {
            categoryNames[cat.id] = await this.security.decrypt(cat.encrypted_name);
        }
        
        for (let i = 0; i < processedData.length; i++) {
            const item = processedData[i];
            const isDuplicate = item.isDuplicate;
            const amountClass = item.amount >= 0 ? 'income' : 'expense';
            
            // Check session mappings first, then item's suggested category
            const sessionMapping = this.importSessionMappings[item.description];
            if (sessionMapping !== undefined && !item.isDuplicate && !item.skip) {
                item.suggestedCategoryId = sessionMapping;
            }
            
            const hasAutoMapping = item.suggestedCategoryId !== null;
            
            html += `
                <div class="csv-review-item ${isDuplicate ? 'duplicate' : ''}" data-item-index="${i}">
                    <div class="csv-review-checkbox">
                        <input type="checkbox" class="csv-skip-checkbox" data-index="${i}" 
                               ${isDuplicate ? 'checked' : ''}>
                        <label style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${isDuplicate ? 'Duplicate' : 'Skip'}
                        </label>
                    </div>
                    
                    <div class="csv-review-details">
                        <div class="csv-review-row">
                            <strong>${item.description}</strong>
                            <span class="amount ${amountClass}">
                                ${item.amount >= 0 ? '+' : ''}${item.amount.toFixed(2)}
                            </span>
                        </div>
                        
                        <div class="csv-review-row" style="font-size: 0.875rem; color: var(--text-secondary);">
                            <span>${item.date}</span>
                            <span>${item.accountName}</span>
                        </div>
                        
                        ${!isDuplicate ? `
                        <div class="csv-mapping-controls" style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                                    <input type="radio" name="mapping-type-${i}" value="auto" class="csv-mapping-type" data-index="${i}" ${hasAutoMapping ? 'checked' : ''}>
                                    Auto ${hasAutoMapping ? `<span style="color: var(--success-color); font-weight: 600;">(${categoryNames[item.suggestedCategoryId]})</span>` : ''}
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                                    <input type="radio" name="mapping-type-${i}" value="manual" class="csv-mapping-type" data-index="${i}" ${!hasAutoMapping ? 'checked' : ''}>
                                    Manual
                                </label>
                            </div>
                            
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <select class="csv-category-select" data-index="${i}" ${hasAutoMapping ? 'disabled' : ''} style="flex: 1;">
                                    <option value="">Select Category...</option>
                                    ${allCategories.map(cat => {
                                        const selected = cat.id === item.suggestedCategoryId ? 'selected' : '';
                                        return `<option value="${cat.id}" ${selected}>${categoryNames[cat.id]}</option>`;
                                    }).join('')}
                                </select>
                                <button class="btn-primary csv-save-mapping hidden" data-index="${i}" style="padding: 0.5rem; font-size: 1rem; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Save as Auto Mapping">
                                    <i data-lucide="check"></i>
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Apply filters and sorting to CSV review items
     */
    applyCSVFiltersAndSort(modal, processedData) {
        const searchQuery = this.csvSearchQuery.toLowerCase();
        const amountMin = parseFloat(document.getElementById('csv-filter-amount-min')?.value) || null;
        const amountMax = parseFloat(document.getElementById('csv-filter-amount-max')?.value) || null;
        const dateStart = document.getElementById('csv-filter-date-start')?.value || null;
        const dateEnd = document.getElementById('csv-filter-date-end')?.value || null;
        const sortField = document.getElementById('csv-sort-field')?.value || 'date';
        const sortOrder = document.getElementById('csv-sort-order')?.value || 'desc';
        
        // Create array of items with their indices
        const items = [];
        modal.querySelectorAll('.csv-review-item').forEach((item) => {
            const dataIndex = parseInt(item.getAttribute('data-item-index'));
            const data = processedData[dataIndex];
            if (!data) return;
            
            let shouldShow = true;
            
            // Apply search filter
            if (searchQuery) {
                const description = (data.description || '').toLowerCase();
                const account = (data.accountName || '').toLowerCase();
                shouldShow = description.includes(searchQuery) || account.includes(searchQuery);
            }
            
            // Apply quick filters
            if (shouldShow && this.csvFilterDuplicates) {
                shouldShow = !data.isDuplicate;
            }
            
            if (shouldShow && this.csvFilterUnmapped) {
                shouldShow = data.suggestedCategoryId === null;
            }
            
            if (shouldShow && this.csvFilterAuto) {
                shouldShow = data.suggestedCategoryId !== null;
            }
            
            // Apply amount filter
            if (shouldShow && amountMin !== null) {
                shouldShow = Math.abs(data.amount) >= amountMin;
            }
            
            if (shouldShow && amountMax !== null) {
                shouldShow = Math.abs(data.amount) <= amountMax;
            }
            
            // Apply date filter
            if (shouldShow && dateStart) {
                shouldShow = new Date(data.date) >= new Date(dateStart);
            }
            
            if (shouldShow && dateEnd) {
                shouldShow = new Date(data.date) <= new Date(dateEnd);
            }
            
            items.push({ element: item, data, shouldShow, index: dataIndex });
        });
        
        // Sort visible items
        const visibleItems = items.filter(item => item.shouldShow);
        visibleItems.sort((a, b) => {
            let aVal, bVal;
            
            switch (sortField) {
                case 'date':
                    aVal = new Date(a.data.date);
                    bVal = new Date(b.data.date);
                    break;
                case 'amount':
                    aVal = Math.abs(a.data.amount);
                    bVal = Math.abs(b.data.amount);
                    break;
                case 'description':
                    aVal = a.data.description.toLowerCase();
                    bVal = b.data.description.toLowerCase();
                    break;
                case 'account':
                    aVal = a.data.accountName.toLowerCase();
                    bVal = b.data.accountName.toLowerCase();
                    break;
                default:
                    return 0;
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        // Apply visibility and reorder
        const container = modal.querySelector('.csv-review-items');
        if (container) {
            // Hide all first
            items.forEach(item => {
                item.element.style.display = 'none';
            });
            
            // Show and reorder visible items
            visibleItems.forEach(item => {
                item.element.style.display = '';
                container.appendChild(item.element);
            });
        }
        
        // Update count
        const visibleCount = document.getElementById('csv-visible-count');
        if (visibleCount) {
            visibleCount.textContent = visibleItems.length;
        }
    }
    
    /**
     * Skip all visible (non-filtered) CSV items
     */
    skipAllVisibleCSVItems(modal, processedData) {
        let skippedCount = 0;
        
        modal.querySelectorAll('.csv-review-item').forEach((item, index) => {
            // Only skip items that are currently visible
            if (item.style.display !== 'none') {
                const checkbox = item.querySelector('.csv-skip-checkbox');
                if (checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    processedData[index].skip = true;
                    skippedCount++;
                }
            }
        });
        
        if (skippedCount > 0) {
            // Optionally show a brief notification
            const skipBtn = document.getElementById('csv-skip-all');
            const originalText = skipBtn.innerHTML;
            skipBtn.innerHTML = `<i data-lucide="check"></i> Skipped ${skippedCount}`;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            setTimeout(() => {
                skipBtn.innerHTML = originalText;
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }, 1500);
        }
    }
    
    /**
     * Update all matching descriptions when Use as Auto Mapping is checked
     */
    async updateMatchingDescriptionsLive(modal, processedData, description, categoryId, allCategories) {
        const categoryNames = {};
        for (const cat of allCategories) {
            categoryNames[cat.id] = await this.security.decrypt(cat.encrypted_name);
        }
        
        // Find all items with matching description
        for (let i = 0; i < processedData.length; i++) {
            const item = processedData[i];
            if (item.description === description && !item.isDuplicate && !item.skip) {
                item.categoryId = categoryId;
                item.suggestedCategoryId = categoryId;
                
                // Update UI for this item
                const itemElement = modal.querySelector(`[data-item-index="${i}"]`);
                if (itemElement) {
                    const autoRadio = itemElement.querySelector('input[value="auto"]');
                    const manualRadio = itemElement.querySelector('input[value="manual"]');
                    const categorySelect = itemElement.querySelector('.csv-category-select');
                    const useMappingCheckbox = itemElement.querySelector('.csv-use-mapping');
                    
                    if (autoRadio && manualRadio && categorySelect) {
                        // Switch to auto mode
                        autoRadio.checked = true;
                        manualRadio.checked = false;
                        categorySelect.disabled = true;
                        categorySelect.value = categoryId;
                        
                        // Update auto label to show category name
                        const autoLabel = autoRadio.parentElement;
                        autoLabel.innerHTML = `
                            <input type="radio" name="mapping-type-${i}" value="auto" class="csv-mapping-type" data-index="${i}" checked>
                            Auto <span style="color: var(--success-color); font-weight: 600;">(${categoryNames[categoryId]})</span>
                        `;
                        
                        // Re-attach event listener
                        const newAutoRadio = autoLabel.querySelector('input');
                        newAutoRadio.addEventListener('change', (e) => {
                            if (e.target.value === 'auto') {
                                categorySelect.disabled = true;
                                if (useMappingCheckbox) {
                                    useMappingCheckbox.disabled = true;
                                    useMappingCheckbox.checked = false;
                                }
                            }
                        });
                        
                        // Re-attach manual radio listener
                        const newManualRadio = itemElement.querySelector('input[value="manual"]');
                        if (newManualRadio) {
                            newManualRadio.addEventListener('change', (e) => {
                                if (e.target.value === 'manual') {
                                    categorySelect.disabled = false;
                                    if (useMappingCheckbox) {
                                        useMappingCheckbox.disabled = false;
                                    }
                                }
                            });
                        }
                        
                        // Hide use mapping checkbox
                        if (useMappingCheckbox) {
                            useMappingCheckbox.parentElement.classList.add('hidden');
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Reset all matching descriptions to manual when Use as Auto Mapping is unchecked
     */
    async resetMatchingDescriptionsToManual(modal, processedData, description, allCategories) {
        const categoryNames = {};
        for (const cat of allCategories) {
            categoryNames[cat.id] = await this.security.decrypt(cat.encrypted_name);
        }
        
        // Find all items with matching description
        for (let i = 0; i < processedData.length; i++) {
            const item = processedData[i];
            if (item.description === description && !item.isDuplicate && !item.skip) {
                item.categoryId = null;
                item.suggestedCategoryId = null;
                
                // Update UI for this item
                const itemElement = modal.querySelector(`[data-item-index="${i}"]`);
                if (itemElement) {
                    const autoRadio = itemElement.querySelector('input[value="auto"]');
                    const manualRadio = itemElement.querySelector('input[value="manual"]');
                    const categorySelect = itemElement.querySelector('.csv-category-select');
                    const useMappingCheckbox = itemElement.querySelector('.csv-use-mapping');
                    
                    if (autoRadio && manualRadio && categorySelect) {
                        // Switch to manual mode
                        autoRadio.checked = false;
                        manualRadio.checked = true;
                        categorySelect.disabled = false;
                        categorySelect.value = '';
                        
                        // Update auto label to remove category name
                        const autoLabel = autoRadio.parentElement;
                        autoLabel.innerHTML = `
                            <input type="radio" name="mapping-type-${i}" value="auto" class="csv-mapping-type" data-index="${i}">
                            Auto
                        `;
                        
                        // Re-attach event listener
                        const newAutoRadio = autoLabel.querySelector('input');
                        newAutoRadio.addEventListener('change', (e) => {
                            if (e.target.value === 'auto') {
                                categorySelect.disabled = true;
                                if (useMappingCheckbox) {
                                    useMappingCheckbox.disabled = true;
                                    useMappingCheckbox.checked = false;
                                }
                            }
                        });
                        
                        const newManualRadio = itemElement.querySelector('input[value="manual"]');
                        newManualRadio.addEventListener('change', (e) => {
                            if (e.target.value === 'manual') {
                                categorySelect.disabled = false;
                                if (useMappingCheckbox) {
                                    useMappingCheckbox.disabled = false;
                                }
                            }
                        });
                        
                        // Show use mapping checkbox
                        if (useMappingCheckbox) {
                            useMappingCheckbox.parentElement.classList.remove('hidden');
                            useMappingCheckbox.checked = false;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Update all matching descriptions in the import when a mapping is set
     */
    async updateMatchingDescriptions(modal, processedData, description, categoryId, allCategories) {
        const categoryNames = {};
        for (const cat of allCategories) {
            categoryNames[cat.id] = await this.security.decrypt(cat.encrypted_name);
        }
        
        // Find all items with matching description
        for (let i = 0; i < processedData.length; i++) {
            const item = processedData[i];
            if (item.description === description && !item.isDuplicate && !item.skip) {
                item.categoryId = categoryId;
                item.suggestedCategoryId = categoryId;
                
                // Update UI for this item
                const itemElement = modal.querySelector(`[data-item-index="${i}"]`);
                if (itemElement) {
                    const autoRadio = itemElement.querySelector('input[value="auto"]');
                    const manualRadio = itemElement.querySelector('input[value="manual"]');
                    const categorySelect = itemElement.querySelector('.csv-category-select');
                    const saveMappingCheckbox = itemElement.querySelector('.csv-save-mapping');
                    
                    if (autoRadio && manualRadio && categorySelect) {
                        // Switch to auto mode
                        autoRadio.checked = true;
                        manualRadio.checked = false;
                        categorySelect.disabled = true;
                        categorySelect.value = categoryId;
                        
                        // Update auto label to show category name
                        const autoLabel = autoRadio.parentElement;
                        autoLabel.innerHTML = `
                            <input type="radio" name="mapping-type-${i}" value="auto" class="csv-mapping-type" data-index="${i}" checked>
                            Auto <span style="color: var(--success-color); font-weight: 600;">(${categoryNames[categoryId]})</span>
                        `;
                        
                        // Re-attach event listener to new radio
                        const newAutoRadio = autoLabel.querySelector('input');
                        newAutoRadio.addEventListener('change', (e) => {
                            if (e.target.value === 'auto') {
                                categorySelect.disabled = true;
                                if (saveMappingCheckbox) {
                                    saveMappingCheckbox.disabled = true;
                                    saveMappingCheckbox.checked = false;
                                }
                            }
                        });
                        
                        // Hide save mapping checkbox (now auto-mapped)
                        if (saveMappingCheckbox) {
                            saveMappingCheckbox.parentElement.classList.add('hidden');
                        }
                    }
                }
            }
        }
    }

    /**
     * Close CSV import page and return to previous tab
     */
    closeCSVImportPage() {
        const csvPage = document.getElementById('csv-import-page');
        const bottomNav = document.querySelector('.bottom-nav');
        
        // Hide CSV import page
        if (csvPage) {
            csvPage.classList.remove('active');
            csvPage.classList.add('hidden');
        }
        
        // Restore bottom navigation
        if (bottomNav) bottomNav.style.display = '';
        
        // Reset CSV filters
        this.csvSearchQuery = '';
        this.csvFilterDuplicates = false;
        this.csvFilterUnmapped = false;
        this.csvFilterAuto = false;
        
        // Return to the tab that was active before opening CSV import
        const returnTab = this.previousTab || 'transactions';
        if (this.uiManager && this.uiManager.showTab) {
            this.uiManager.showTab(returnTab);
        }
    }
    
    /**
     * Handle CSV import after review
     */
    async handleCSVImport(processedData, csvEngine) {
        // Filter out skipped and duplicate items
        const toImport = processedData.filter(item => !item.skip && !item.isDuplicate);
        
        if (toImport.length === 0) {
            alert('No transactions selected for import');
            return;
        }
        
        try {
            // Determine which items need mapping saved
            const csvPage = document.getElementById('csv-import-page');
            toImport.forEach((item, idx) => {
                const actualIndex = processedData.indexOf(item);
                const useMappingCheckbox = csvPage.querySelector(`[data-item-index="${actualIndex}"] .csv-use-mapping`);
                item.saveMapping = useMappingCheckbox ? useMappingCheckbox.checked : false;
            });
            
            const imported = await csvEngine.importReviewedTransactions(toImport);
            
            alert(`Successfully imported ${imported.length} transaction(s)`);
            
            // Refresh the transactions view
            await this.renderTransactionsTab();
        } catch (error) {
            console.error('CSV import failed:', error);
            alert('Import failed: ' + error.message);
        }
    }
}
