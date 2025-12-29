// TransactionUI - Handles transaction display, forms, CRUD, search/filter/sort, undo/redo
import { CustomSelect } from './custom-select.js';

export class TransactionUI {
    constructor(security, db, accountMappingsUI) {
        this.security = security;
        this.db = db;
        this.accountMappingsUI = accountMappingsUI;
        
        // Custom select instances
        this.categorySelect = null;
        this.linkSelect = null;
        
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
            dateEnd: null,
            unlinkedTransfersOnly: false,
            uncategorizedOnly: false
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
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Decrypt all transactions with full data
        const categories = await this.db.getAllCategories();
        const decryptedTransactions = await Promise.all(
            allTransactions.map(async (t) => {
                const category = categories.find(c => c.id === t.categoryId);
                const linkedTransactionId = t.encrypted_linkedTransactionId 
                    ? await this.security.decrypt(t.encrypted_linkedTransactionId) 
                    : null;
                
                // Determine category type
                // Transfer: no categoryId AND has encrypted_linkedTransactionId field (even if null for unlinked)
                // Uncategorized: no categoryId AND no encrypted_linkedTransactionId field
                let categoryType;
                if (!t.categoryId) {
                    categoryType = (t.encrypted_linkedTransactionId !== undefined) ? 'Transfer' : 'Uncategorized';
                } else {
                    categoryType = category ? category.type : 'Expense';
                }
                
                const rawAccount = t.encrypted_account ? await this.security.decrypt(t.encrypted_account) : '';
                const accountDisplayName = rawAccount ? await this.accountMappingsUI.getAccountDisplayName(rawAccount) : '';
                
                return {
                    id: t.id,
                    date: await this.security.decrypt(t.encrypted_date),
                    amount: parseFloat(await this.security.decrypt(t.encrypted_amount)),
                    description: t.encrypted_description ? await this.security.decrypt(t.encrypted_description) : 'No description',
                    account: rawAccount,
                    accountDisplayName: accountDisplayName,
                    note: t.encrypted_note ? await this.security.decrypt(t.encrypted_note) : '',
                    categoryId: t.categoryId,
                    categoryName: await this.getCategoryName(t.categoryId, categories),
                    categoryType: categoryType,
                    linkedTransactionId: linkedTransactionId ? parseInt(linkedTransactionId) : null
                };
            })
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
            
            const isTransfer = t.categoryType === 'Transfer';
            const linkIcon = isTransfer && t.linkedTransactionId ? '<i data-lucide="link" style="width: 14px; height: 14px; margin-left: 4px; vertical-align: middle;"></i>' : '';
            
            html += `
                <div class="transaction-item" data-id="${t.id}">
                    <div class="transaction-header">
                        <span class="transaction-desc">${t.description}${linkIcon}</span>
                        <span class="transaction-amount ${amountClass}">
                            ${t.amount >= 0 ? '+' : '-'}$${displayAmount.toFixed(2)}
                        </span>
                    </div>
                    <div class="transaction-date">${formattedDate}</div>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="transactions-scroll-container">
                ${html || '<div class="empty-state"><p>No transactions match your search</p></div>'}
            </div>
        `;
        
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
            const accountDisplayName = account ? await this.accountMappingsUI.getAccountDisplayName(account) : '';
            const linkedTransactionId = transaction.encrypted_linkedTransactionId 
                ? await this.security.decrypt(transaction.encrypted_linkedTransactionId) 
                : null;
            
            // Check if this is a Transfer type
            // Transfer: has the encrypted_linkedTransactionId field (even if null for unlinked)
            // Uncategorized: no categoryId AND no encrypted_linkedTransactionId field
            const isTransfer = !transaction.categoryId && transaction.encrypted_linkedTransactionId !== undefined;
            
            document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
            // Convert date to YYYY-MM-DD format for date input
            const dateForInput = this.formatDateForInput(date);
            document.getElementById('transaction-date').value = dateForInput;
            document.getElementById('transaction-amount').value = amount;
            document.getElementById('transaction-description').value = description;
            document.getElementById('transaction-account').value = accountDisplayName;
            document.getElementById('transaction-account').dataset.accountNumber = account;
            
            // Set editId BEFORE populating link select so self-exclusion works
            form.dataset.editId = transactionId;
            
            if (isTransfer) {
                document.getElementById('transaction-category').value = 'TRANSFER';
                // Refresh custom select to reflect the value change
                if (this.categorySelect) {
                    this.categorySelect.refresh();
                }
                // Show link field for transfer
                const linkGroup = document.getElementById('transaction-link-group');
                if (linkGroup) {
                    linkGroup.style.display = 'block';
                    await this.populateLinkSelect();
                    if (linkedTransactionId) {
                        document.getElementById('transaction-link').value = linkedTransactionId;
                    }
                }
            } else {
                document.getElementById('transaction-category').value = transaction.categoryId || '';
                // Refresh custom select to reflect the value change
                if (this.categorySelect) {
                    this.categorySelect.refresh();
                }
                // Hide link field for non-transfer
                const linkGroup = document.getElementById('transaction-link-group');
                if (linkGroup) {
                    linkGroup.style.display = 'none';
                }
            }
            
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
            document.getElementById('transaction-account').dataset.accountNumber = '';
            document.getElementById('transaction-account').dataset.accountNumber = '';
            
            // Reset category/link field display
            const linkGroup = document.getElementById('transaction-link-group');
            const categoryGroup = document.getElementById('transaction-category').closest('.input-group');
            if (linkGroup && categoryGroup) {
                categoryGroup.style.display = 'block';
                linkGroup.style.display = 'none';
            }
            
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
        document.body.classList.add('modal-open');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Initialize custom selects if not already done
        if (!this.categorySelect) {
            const categorySelectEl = document.getElementById('transaction-category');
            if (categorySelectEl) {
                this.categorySelect = new CustomSelect(categorySelectEl);
            }
        }
        
        if (!this.linkSelect) {
            const linkSelectEl = document.getElementById('transaction-link');
            if (linkSelectEl) {
                this.linkSelect = new CustomSelect(linkSelectEl);
            }
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
        
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (grouped[type].length === 0) continue;
            
            html += `<optgroup label="${type}">`;
            grouped[type].forEach(cat => {
                html += `<option value="${cat.id}">${cat.name}</option>`;
            });
            html += `</optgroup>`;
        }
        
        // Add Transfer as a standalone option (no categories)
        html += `<option value="TRANSFER">Transfer</option>`;
        
        select.innerHTML = html;
        
        // Refresh custom select if it exists
        if (this.categorySelect) {
            this.categorySelect.refresh();
        }
        
        // Setup event listener for category change to show/hide link field
        this.setupCategoryChangeListener();
    }

    setupCategoryChangeListener() {
        const categorySelect = document.getElementById('transaction-category');
        const linkGroup = document.getElementById('transaction-link-group');
        const categoryGroup = categorySelect?.closest('.input-group');
        
        if (!categorySelect || !linkGroup) return;
        
        // Remove old listener if exists
        if (categorySelect._changeHandler) {
            categorySelect.removeEventListener('change', categorySelect._changeHandler);
        }
        
        // Create new handler
        const handler = async () => {
            const value = categorySelect.value;
            
            if (value === 'TRANSFER') {
                // Show link field instead of category
                linkGroup.style.display = 'block';
                categorySelect.removeAttribute('required');
                await this.populateLinkSelect();
            } else {
                // Show category field
                linkGroup.style.display = 'none';
                categorySelect.setAttribute('required', 'required');
            }
        };
        
        // Store handler reference and add listener
        categorySelect._changeHandler = handler;
        categorySelect.addEventListener('change', handler);
    }

    async populateLinkSelect() {
        const linkSelect = document.getElementById('transaction-link');
        if (!linkSelect) return;
        
        const allTransactions = await this.db.getAllTransactions();
        const categories = await this.db.getAllCategories();
        const form = document.getElementById('transaction-form');
        const currentId = form?.dataset.editId ? parseInt(form.dataset.editId) : null;
        
        // Get current transaction's account and date for filtering/sorting
        const currentAccount = document.getElementById('transaction-account')?.value || '';
        const currentDate = document.getElementById('transaction-date')?.value || '';
        
        // Get all unlinked transfer transactions (excluding current)
        const transferTransactions = [];
        for (const t of allTransactions) {
            if (t.id === currentId) continue; // Skip current transaction
            
            // Transfer transactions have no categoryId
            if (t.categoryId !== null) continue; // Skip non-Transfer transactions
            
            // Check if already linked
            if (t.encrypted_linkedTransactionId) {
                const linkedId = parseInt(await this.security.decrypt(t.encrypted_linkedTransactionId));
                if (linkedId && linkedId !== currentId) continue; // Already linked to something else
            }
            
            const date = await this.security.decrypt(t.encrypted_date);
            const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
            const description = t.encrypted_description 
                ? await this.security.decrypt(t.encrypted_description) 
                : 'No description';
            const account = t.encrypted_account 
                ? await this.security.decrypt(t.encrypted_account) 
                : '';
            
            // Skip transfers from the same account (can't transfer to yourself)
            if (account === currentAccount) continue;
            
            const accountDisplayName = account ? await this.accountMappingsUI.getAccountDisplayName(account) : '';
            
            transferTransactions.push({ id: t.id, date, amount, description, account, accountDisplayName });
        }
        
        let html = '<option value="">No link (leave unlinked)</option>';
        let displayCount = 0;
        
        // Filter to only show matching amounts (opposite sign) and different accounts
        const currentAmount = document.getElementById('transaction-amount')?.value;
        if (currentAmount) {
            const matchingTransfers = transferTransactions.filter(t => 
                Math.abs(t.amount) === parseFloat(currentAmount)
            );
            
            // Sort: same date first, then by date descending
            // Normalize currentDate format (YYYY-MM-DD to MM/DD/YYYY for comparison)
            const currentDateParts = currentDate.split('-');
            const normalizedCurrentDate = currentDateParts.length === 3 
                ? `${currentDateParts[1]}/${currentDateParts[2]}/${currentDateParts[0]}`
                : currentDate;
            
            matchingTransfers.sort((a, b) => {
                const aIsSameDate = a.date === normalizedCurrentDate;
                const bIsSameDate = b.date === normalizedCurrentDate;
                
                if (aIsSameDate && !bIsSameDate) return -1;
                if (!aIsSameDate && bIsSameDate) return 1;
                
                // Both same date or both different dates - sort by date descending
                return new Date(b.date) - new Date(a.date);
            });
            
            if (matchingTransfers.length > 0) {
                matchingTransfers.forEach(t => {
                    const sign = t.amount >= 0 ? '+' : '-';
                    html += `<option value="${t.id}">${t.date} • ${sign}$${Math.abs(t.amount).toFixed(2)} • ${t.accountDisplayName}</option>`;
                });
                displayCount = matchingTransfers.length;
            }
        } else {
            // If no amount entered yet, show all transfers (sorted)
            const currentDateParts = currentDate.split('-');
            const normalizedCurrentDate = currentDateParts.length === 3 
                ? `${currentDateParts[1]}/${currentDateParts[2]}/${currentDateParts[0]}`
                : currentDate;
            
            transferTransactions.sort((a, b) => {
                const aIsSameDate = a.date === normalizedCurrentDate;
                const bIsSameDate = b.date === normalizedCurrentDate;
                
                if (aIsSameDate && !bIsSameDate) return -1;
                if (!aIsSameDate && bIsSameDate) return 1;
                
                return new Date(b.date) - new Date(a.date);
            });
            
            transferTransactions.forEach(t => {
                const sign = t.amount >= 0 ? '+' : '-';
                html += `<option value="${t.id}">${t.date} • ${sign}$${Math.abs(t.amount).toFixed(2)} • ${t.accountDisplayName}</option>`;
            });
            displayCount = transferTransactions.length;
        }
        
        linkSelect.innerHTML = html;
        
        // Refresh custom select if it exists
        if (this.linkSelect) {
            this.linkSelect.refresh();
        }
    }

    async saveTransaction(onSuccess) {
        console.log('💾 Saving transaction...');
        
        const form = document.getElementById('transaction-form');
        const date = document.getElementById('transaction-date').value;
        const amount = document.getElementById('transaction-amount').value;
        const categoryValue = document.getElementById('transaction-category').value;
        const linkedTransactionId = document.getElementById('transaction-link')?.value;
        const description = document.getElementById('transaction-description').value.trim();
        const accountInput = document.getElementById('transaction-account');
        // If editing existing transaction, use stored account number; otherwise use input value
        const account = accountInput.dataset.accountNumber || accountInput.value.trim();
        
        // Check if Transfer type
        const isTransfer = categoryValue === 'TRANSFER';
        
        if (!date || !amount) {
            alert('Please fill in Date and Amount');
            return;
        }
        
        // Category is now optional - allow uncategorized transactions
        
        try {
            let categoryId = null;
            let categoryType = 'Transfer';
            let signedAmount = parseFloat(amount);
            
            if (isTransfer) {
                // For Transfer, determine sign based on current amount input
                // User should input positive for inflow, negative for outflow
                // But we'll keep whatever sign they enter
            } else {
                categoryId = parseInt(categoryValue);
                const category = await this.db.getCategory(categoryId);
                categoryType = category.type || 'Expense';
                
                if (categoryType === 'Income') {
                    signedAmount = Math.abs(signedAmount);
                } else if (categoryType === 'Expense' || categoryType === 'Saving') {
                    signedAmount = -Math.abs(signedAmount);
                }
            }
            
            const transaction = {
                encrypted_date: await this.security.encrypt(date),
                encrypted_amount: await this.security.encrypt(signedAmount.toString()),
                encrypted_description: description ? await this.security.encrypt(description) : '',
                encrypted_account: account ? await this.security.encrypt(account) : '',
                categoryId: categoryId
            };
            
            // Only set linked transaction field for Transfer type
            // This allows us to distinguish between Uncategorized (no field) and Unlinked Transfer (field = null)
            if (isTransfer) {
                transaction.encrypted_linkedTransactionId = linkedTransactionId 
                    ? await this.security.encrypt(linkedTransactionId) 
                    : null;
            }
            // Note: For non-transfers, we don't set this field at all
            // When editing, Dexie will remove it from the record if not present in update object
            
            if (form.dataset.editId) {
                transaction.id = parseInt(form.dataset.editId);
            }
            
            // Auto-populate account mapping if account number is provided
            if (account) {
                await this.accountMappingsUI.ensureAccountMappingExists(account);
            }
            
            const transactionId = await this.db.saveTransaction(transaction);
            
            // If linking to another transfer, update that transaction bidirectionally
            if (isTransfer && linkedTransactionId && linkedTransactionId !== '') {
                const linkedTx = await this.db.getTransaction(parseInt(linkedTransactionId));
                if (linkedTx) {
                    linkedTx.encrypted_linkedTransactionId = await this.security.encrypt(transactionId.toString());
                    await this.db.saveTransaction(linkedTx);
                }
            }
            
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
            // Check if this transaction is linked to another Transfer
            const transaction = await this.db.getTransaction(transactionId);
            if (transaction && transaction.encrypted_linkedTransactionId) {
                const linkedId = parseInt(await this.security.decrypt(transaction.encrypted_linkedTransactionId));
                
                // Unlink the linked transaction
                const linkedTx = await this.db.getTransaction(linkedId);
                if (linkedTx) {
                    linkedTx.encrypted_linkedTransactionId = null;
                    await this.db.saveTransaction(linkedTx);
                }
            }
            
            await this.db.deleteTransaction(transactionId);
            document.getElementById('transaction-modal').classList.add('hidden');
            document.body.classList.remove('modal-open');
            
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
        if (!categoryId) return 'Transfer'; // Handle Transfer type (no category)
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
            filtered = filtered.filter(t => this.filters.accounts.includes(t.accountDisplayName));
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
        if (this.filters.unlinkedTransfersOnly) {
            filtered = filtered.filter(t => t.categoryType === 'Transfer' && !t.linkedTransactionId);
        }
        if (this.filters.uncategorizedOnly) {
            filtered = filtered.filter(t => t.categoryType === 'Uncategorized');
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
                if (account) {
                    const displayName = await this.accountMappingsUI.getAccountDisplayName(account);
                    uniqueAccounts.add(displayName);
                }
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
