// TransactionUI - Handles transaction display, forms, CRUD, search/filter/sort, undo/redo
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

    formatDateForInput(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString;
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return dateString;
        }
    }
}
