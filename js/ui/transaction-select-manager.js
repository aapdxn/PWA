// transaction-select-manager.js - Manages category, payee, and link select dropdowns
import { CustomSelect } from './custom-select.js';

export class TransactionSelectManager {
    constructor(deps) {
        Object.assign(this, deps); // { security, db, accountMappingsUI }
        
        // Custom select instances
        this.categorySelect = null;
        this.payeeSelect = null;
        this.linkSelect = null;
    }

    /**
     * Initialize custom select instances
     */
    initializeSelects() {
        const categorySelectEl = document.getElementById('transaction-category');
        if (categorySelectEl && !this.categorySelect) {
            this.categorySelect = new CustomSelect(categorySelectEl);
        }
        
        const payeeSelectEl = document.getElementById('transaction-payee');
        if (payeeSelectEl && !this.payeeSelect) {
            this.payeeSelect = new CustomSelect(payeeSelectEl);
        }
        
        const linkSelectEl = document.getElementById('transaction-link');
        if (linkSelectEl && !this.linkSelect) {
            this.linkSelect = new CustomSelect(linkSelectEl);
        }
    }

    /**
     * Populate category select dropdown with auto-mapping support
     */
    async populateCategorySelect() {
        const select = document.getElementById('transaction-category');
        if (!select) return;
        
        const categories = await this.db.getAllCategories();
        const currentValue = select.value;
        
        // Check if there's a mapping for current description
        const descriptionInput = document.getElementById('transaction-description');
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        let autoMapping = null;
        
        if (description) {
            const mappings = await this.db.getAllMappingsDescriptions();
            autoMapping = mappings.find(m => m.description === description);
        }
        
        // Dynamic first option
        const firstOptionText = currentValue && currentValue !== '' && currentValue !== 'AUTO' && currentValue !== 'CREATE_NEW' && currentValue !== 'TRANSFER' 
            ? 'Clear Category' 
            : 'Select category...';
        let html = `<option value="">${firstOptionText}</option>`;
        
        // Add Auto option
        if (autoMapping && autoMapping.encrypted_category) {
            const mappedCategoryName = await this.security.decrypt(autoMapping.encrypted_category);
            html += `<option value="AUTO">🔄 Auto (${mappedCategoryName})</option>`;
        } else {
            html += `<option value="AUTO">🔄 Auto</option>`;
        }
        
        // Add Create New option
        html += `<option value="CREATE_NEW">➕ Create New Category</option>`;
        
        // Add Transfer
        html += `<option value="TRANSFER">Transfer</option>`;
        
        // Group categories by type
        const grouped = { Income: [], Expense: [], Saving: [] };
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
        
        select.innerHTML = html;
        
        // Refresh custom select
        if (this.categorySelect) {
            this.categorySelect.refresh();
        }
        
        // Setup event listeners
        this.setupCategoryChangeListener();
    }

    /**
     * Setup category select change listener
     */
    setupCategoryChangeListener() {
        const categorySelect = document.getElementById('transaction-category');
        const linkGroup = document.getElementById('transaction-link-group');
        
        if (!categorySelect || !linkGroup) return;
        
        // Remove old listener if exists
        if (categorySelect._changeHandler) {
            categorySelect.removeEventListener('change', categorySelect._changeHandler);
        }
        
        // Create new handler
        const handler = async () => {
            const value = categorySelect.value;
            
            // Handle Create New Category
            if (value === 'CREATE_NEW') {
                await this.handleCreateNewCategory();
                return;
            }
            
            // Handle Auto with no mapping
            if (value === 'AUTO') {
                const descriptionInput = document.getElementById('transaction-description');
                const description = descriptionInput ? descriptionInput.value.trim() : '';
                
                if (description) {
                    const mappings = await this.db.getAllMappingsDescriptions();
                    const mapping = mappings.find(m => m.description === description);
                    
                    if (!mapping || !mapping.encrypted_category) {
                        const created = await this.handleCreateCategoryMapping(description);
                        if (!created) {
                            categorySelect.value = '';
                            if (this.categorySelect) this.categorySelect.refresh();
                            return;
                        }
                    }
                }
            }
            
            // Determine if category is Transfer
            const isTransfer = await this.isCategoryTransfer(value);
            
            if (isTransfer) {
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

    /**
     * Check if category value resolves to Transfer
     */
    async isCategoryTransfer(value) {
        if (value === 'TRANSFER') return true;
        
        if (value === 'AUTO') {
            const descriptionInput = document.getElementById('transaction-description');
            const description = descriptionInput ? descriptionInput.value.trim() : '';
            
            if (description) {
                const mappings = await this.db.getAllMappingsDescriptions();
                const mapping = mappings.find(m => m.description === description);
                
                if (mapping && mapping.encrypted_category) {
                    const categoryName = await this.security.decrypt(mapping.encrypted_category);
                    return categoryName === 'Transfer';
                }
            }
        }
        
        return false;
    }

    /**
     * Populate payee select dropdown with auto-mapping support
     */
    async populatePayeeSelect() {
        const select = document.getElementById('transaction-payee');
        if (!select) return;
        
        const payees = await this.db.getAllPayees();
        const currentValue = select.value;
        
        // Check if there's a mapping for current description
        const descriptionInput = document.getElementById('transaction-description');
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        let autoMapping = null;
        
        if (description) {
            const mappings = await this.db.getAllMappingsDescriptions();
            autoMapping = mappings.find(m => m.description === description);
        }
        
        // Dynamic first option
        const firstOptionText = currentValue && currentValue !== '' && currentValue !== 'AUTO' && currentValue !== 'ADD_NEW' 
            ? 'Clear Payee' 
            : 'Select payee...';
        let html = `<option value="">${firstOptionText}</option>`;
        
        // Add Auto option
        if (autoMapping && autoMapping.encrypted_payee) {
            const mappedPayeeName = await this.security.decrypt(autoMapping.encrypted_payee);
            if (mappedPayeeName) {
                html += `<option value="AUTO">🔄 Auto (${mappedPayeeName})</option>`;
            } else {
                html += `<option value="AUTO">🔄 Auto</option>`;
            }
        } else {
            html += `<option value="AUTO">🔄 Auto</option>`;
        }
        
        // Add option to create new payee
        html += `<option value="ADD_NEW">➕ Add New Payee</option>`;
        
        // Sort payees alphabetically
        const decryptedPayees = await Promise.all(
            payees.map(async (p) => ({
                id: p.id,
                name: await this.security.decrypt(p.encrypted_name)
            }))
        );
        decryptedPayees.sort((a, b) => a.name.localeCompare(b.name));
        
        decryptedPayees.forEach(payee => {
            html += `<option value="${payee.id}">${payee.name}</option>`;
        });
        
        select.innerHTML = html;
        
        // Refresh custom select
        if (this.payeeSelect) {
            this.payeeSelect.refresh();
        }
        
        // Setup event listener
        this.setupPayeeChangeListener();
    }

    /**
     * Setup payee select change listener
     */
    setupPayeeChangeListener() {
        const payeeSelect = document.getElementById('transaction-payee');
        if (!payeeSelect) return;
        
        // Remove old listener if exists
        if (payeeSelect._changeHandler) {
            payeeSelect.removeEventListener('change', payeeSelect._changeHandler);
        }
        
        // Create new handler
        const handler = async () => {
            // Handle Add New Payee
            if (payeeSelect.value === 'ADD_NEW') {
                const payeeName = prompt('Enter new payee name:');
                if (payeeName && payeeName.trim()) {
                    const trimmedName = payeeName.trim();
                    
                    // Check for duplicate
                    const existingPayees = await this.db.getAllPayees();
                    for (const p of existingPayees) {
                        const existingName = await this.security.decrypt(p.encrypted_name);
                        if (existingName.toLowerCase() === trimmedName.toLowerCase()) {
                            alert('A payee with this name already exists.');
                            payeeSelect.value = '';
                            if (this.payeeSelect) this.payeeSelect.refresh();
                            return;
                        }
                    }
                    
                    // Create new payee
                    const newPayeeId = await this.db.savePayee({
                        encrypted_name: await this.security.encrypt(trimmedName)
                    });
                    
                    // Refresh the payee select
                    await this.populatePayeeSelect();
                    
                    // Set the new payee as selected
                    payeeSelect.value = newPayeeId;
                    if (this.payeeSelect) this.payeeSelect.refresh();
                } else {
                    payeeSelect.value = '';
                    if (this.payeeSelect) this.payeeSelect.refresh();
                }
                return;
            }
            
            // Handle Auto with no mapping
            if (payeeSelect.value === 'AUTO') {
                const descriptionInput = document.getElementById('transaction-description');
                const description = descriptionInput ? descriptionInput.value.trim() : '';
                
                if (description) {
                    const mappings = await this.db.getAllMappingsDescriptions();
                    const mapping = mappings.find(m => m.description === description);
                    
                    if (!mapping || !mapping.encrypted_payee) {
                        const created = await this.handleCreatePayeeMapping(description);
                        if (!created) {
                            payeeSelect.value = '';
                            if (this.payeeSelect) this.payeeSelect.refresh();
                        }
                    }
                }
            }
        };
        
        // Store handler reference and add listener
        payeeSelect._changeHandler = handler;
        payeeSelect.addEventListener('change', handler);
    }

    /**
     * Populate link select for transfer transactions
     */
    async populateLinkSelect() {
        const linkSelect = document.getElementById('transaction-link');
        if (!linkSelect) return;
        
        const allTransactions = await this.db.getAllTransactions();
        const form = document.getElementById('transaction-form');
        const currentId = form?.dataset.editId ? parseInt(form.dataset.editId) : null;
        
        // Get current transaction's account and date for filtering/sorting
        const currentAccount = document.getElementById('transaction-account')?.dataset.accountNumber || '';
        const currentDate = document.getElementById('transaction-date')?.value || '';
        const currentAmount = document.getElementById('transaction-amount')?.value;
        
        // Get all eligible transfer transactions
        const transferTransactions = await this.getEligibleTransfers(allTransactions, currentId, currentAccount, currentDate);
        
        let html = '<option value="">No link (leave unlinked)</option>';
        
        // Filter and sort transfers
        const sortedTransfers = this.filterAndSortTransfers(transferTransactions, currentDate, currentAmount);
        
        // Build options
        sortedTransfers.forEach(t => {
            const sign = t.amount >= 0 ? '+' : '-';
            const formattedDate = new Date(t.date).toLocaleDateString('en-US', { 
                month: '2-digit', 
                day: '2-digit', 
                year: 'numeric' 
            });
            html += `<option value="${t.id}">${formattedDate} • ${sign}$${Math.abs(t.amount).toFixed(2)} • ${t.accountDisplayName}</option>`;
        });
        
        linkSelect.innerHTML = html;
        
        // Refresh custom select
        if (this.linkSelect) {
            this.linkSelect.refresh();
        }
    }

    /**
     * Get eligible transfer transactions for linking
     */
    async getEligibleTransfers(allTransactions, currentId, currentAccount, currentDate) {
        const transferTransactions = [];
        
        for (const t of allTransactions) {
            if (t.id === currentId) continue; // Skip current transaction
            if (t.categoryId !== null) continue; // Skip non-Transfer transactions
            
            // Check if already linked to a different transaction
            if (t.encrypted_linkedTransactionId) {
                const linkedId = parseInt(await this.security.decrypt(t.encrypted_linkedTransactionId));
                if (linkedId && linkedId !== currentId) continue;
            }
            
            const date = await this.security.decrypt(t.encrypted_date);
            const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
            const description = t.encrypted_description 
                ? await this.security.decrypt(t.encrypted_description) 
                : 'No description';
            const account = t.encrypted_account 
                ? await this.security.decrypt(t.encrypted_account) 
                : '';
            
            // Skip transfers from the same account
            if (account === currentAccount) continue;
            
            // Filter by date range (±10 days)
            if (currentDate) {
                const currentDateObj = new Date(currentDate);
                const transactionDateObj = new Date(date);
                const daysDiff = Math.abs((currentDateObj - transactionDateObj) / (1000 * 60 * 60 * 24));
                if (daysDiff > 10) continue;
            }
            
            const accountDisplayName = account ? await this.accountMappingsUI.getAccountDisplayName(account) : '';
            
            transferTransactions.push({ id: t.id, date, amount, description, account, accountDisplayName });
        }
        
        return transferTransactions;
    }

    /**
     * Filter and sort transfers by amount and date
     */
    filterAndSortTransfers(transfers, currentDate, currentAmount) {
        let filtered = transfers;
        
        // Filter by matching amount if provided
        if (currentAmount) {
            filtered = transfers.filter(t => Math.abs(t.amount) === parseFloat(currentAmount));
        }
        
        // Normalize current date format
        const currentDateParts = currentDate.split('-');
        const normalizedCurrentDate = currentDateParts.length === 3 
            ? `${currentDateParts[1]}/${currentDateParts[2]}/${currentDateParts[0]}`
            : currentDate;
        
        // Sort: same date first, then by date descending
        filtered.sort((a, b) => {
            const aIsSameDate = a.date === normalizedCurrentDate;
            const bIsSameDate = b.date === normalizedCurrentDate;
            
            if (aIsSameDate && !bIsSameDate) return -1;
            if (!aIsSameDate && bIsSameDate) return 1;
            
            return new Date(b.date) - new Date(a.date);
        });
        
        return filtered;
    }

    /**
     * Handle creating a new category mapping
     */
    async handleCreateCategoryMapping(description) {
        const categories = await this.db.getAllCategories();
        
        let options = 'Select a category for auto-mapping:\\n\\n';
        options += '0. Transfer\\n';
        
        const grouped = { Income: [], Expense: [], Saving: [] };
        for (const cat of categories) {
            const name = await this.security.decrypt(cat.encrypted_name);
            grouped[cat.type || 'Expense'].push({ id: cat.id, name });
        }
        
        let index = 1;
        const indexMap = {};
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (grouped[type].length === 0) continue;
            options += `\\n${type}:\\n`;
            for (const cat of grouped[type]) {
                options += `${index}. ${cat.name}\\n`;
                indexMap[index] = { id: cat.id, name: cat.name };
                index++;
            }
        }
        
        const choice = prompt(options + '\\nEnter number (or cancel):');
        if (choice === null || choice.trim() === '') {
            return false;
        }
        
        const choiceNum = parseInt(choice);
        let categoryName;
        
        if (choiceNum === 0) {
            categoryName = 'Transfer';
        } else if (indexMap[choiceNum]) {
            categoryName = indexMap[choiceNum].name;
        } else {
            alert('Invalid choice');
            return false;
        }
        
        // Create the mapping
        await this.db.setMappingDescription(
            description,
            await this.security.encrypt(categoryName),
            null
        );
        
        // Refresh dropdown
        await this.populateCategorySelect();
        
        // Keep AUTO selected
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            categorySelect.value = 'AUTO';
            if (this.categorySelect) this.categorySelect.refresh();
        }
        
        return true;
    }

    /**
     * Handle creating a new payee mapping
     */
    async handleCreatePayeeMapping(description) {
        const payees = await this.db.getAllPayees();
        
        const decryptedPayees = await Promise.all(
            payees.map(async (p) => ({
                id: p.id,
                name: await this.security.decrypt(p.encrypted_name)
            }))
        );
        decryptedPayees.sort((a, b) => a.name.localeCompare(b.name));
        
        let options = 'Select a payee for auto-mapping:\\n\\n';
        decryptedPayees.forEach((payee, index) => {
            options += `${index + 1}. ${payee.name}\\n`;
        });
        
        const choice = prompt(options + '\\nEnter number (or cancel):');
        if (choice === null || choice.trim() === '') {
            return false;
        }
        
        const choiceNum = parseInt(choice) - 1;
        if (choiceNum < 0 || choiceNum >= decryptedPayees.length) {
            alert('Invalid choice');
            return false;
        }
        
        const selectedPayee = decryptedPayees[choiceNum];
        
        // Get existing mapping
        const mappings = await this.db.getAllMappingsDescriptions();
        const existing = mappings.find(m => m.description === description);
        const existingCategory = existing && existing.encrypted_category ? existing.encrypted_category : null;
        
        // Update/create the mapping
        await this.db.setMappingDescription(
            description,
            existingCategory,
            await this.security.encrypt(selectedPayee.name)
        );
        
        // Refresh dropdown
        await this.populatePayeeSelect();
        
        // Keep AUTO selected
        const payeeSelect = document.getElementById('transaction-payee');
        if (payeeSelect) {
            payeeSelect.value = 'AUTO';
            if (this.payeeSelect) this.payeeSelect.refresh();
        }
        
        return true;
    }

    /**
     * Handle creating a new category
     */
    async handleCreateNewCategory() {
        const categoryName = prompt('Enter new category name:');
        if (!categoryName || !categoryName.trim()) {
            const categorySelect = document.getElementById('transaction-category');
            if (categorySelect) {
                categorySelect.value = '';
                if (this.categorySelect) this.categorySelect.refresh();
            }
            return;
        }
        
        const trimmedName = categoryName.trim();
        
        // Check for duplicate
        const existingCategories = await this.db.getAllCategories();
        for (const cat of existingCategories) {
            const existingName = await this.security.decrypt(cat.encrypted_name);
            if (existingName.toLowerCase() === trimmedName.toLowerCase()) {
                alert('A category with this name already exists.');
                const categorySelect = document.getElementById('transaction-category');
                if (categorySelect) {
                    categorySelect.value = '';
                    if (this.categorySelect) this.categorySelect.refresh();
                }
                return;
            }
        }
        
        // Prompt for type
        const type = prompt('Select type:\\n1. Income\\n2. Expense\\n3. Saving\\n\\nEnter number:');
        let categoryType;
        
        switch(type) {
            case '1': categoryType = 'Income'; break;
            case '2': categoryType = 'Expense'; break;
            case '3': categoryType = 'Saving'; break;
            default:
                alert('Invalid type selected');
                const categorySelect = document.getElementById('transaction-category');
                if (categorySelect) {
                    categorySelect.value = '';
                    if (this.categorySelect) this.categorySelect.refresh();
                }
                return;
        }
        
        // Create new category
        const newCategoryId = await this.db.saveCategory({
            encrypted_name: await this.security.encrypt(trimmedName),
            type: categoryType,
            encrypted_limit: null
        });
        
        // Refresh the category select
        await this.populateCategorySelect();
        
        // Set the new category as selected
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            categorySelect.value = newCategoryId;
            if (this.categorySelect) this.categorySelect.refresh();
        }
    }

    /**
     * Setup description change listener to update Auto options
     */
    setupDescriptionChangeListener() {
        const descriptionInput = document.getElementById('transaction-description');
        if (!descriptionInput) return;
        
        // Remove old listener if exists
        if (descriptionInput._changeHandler) {
            descriptionInput.removeEventListener('blur', descriptionInput._changeHandler);
        }
        
        // Create new handler
        const handler = async () => {
            const currentCategoryValue = document.getElementById('transaction-category')?.value;
            const currentPayeeValue = document.getElementById('transaction-payee')?.value;
            const isNewTransaction = !document.getElementById('transaction-form')?.dataset.editId;
            
            await this.populateCategorySelect();
            await this.populatePayeeSelect();
            
            // Restore selections if they still exist
            const categorySelect = document.getElementById('transaction-category');
            const payeeSelect = document.getElementById('transaction-payee');
            
            if (categorySelect && currentCategoryValue) {
                const optionExists = Array.from(categorySelect.options).some(opt => opt.value === currentCategoryValue);
                if (optionExists) {
                    categorySelect.value = currentCategoryValue;
                } else if (isNewTransaction) {
                    const autoOptionExists = Array.from(categorySelect.options).some(opt => opt.value === 'AUTO');
                    if (autoOptionExists) categorySelect.value = 'AUTO';
                }
            } else if (isNewTransaction && categorySelect) {
                const autoOptionExists = Array.from(categorySelect.options).some(opt => opt.value === 'AUTO');
                if (autoOptionExists) categorySelect.value = 'AUTO';
            }
            
            if (payeeSelect && currentPayeeValue) {
                const optionExists = Array.from(payeeSelect.options).some(opt => opt.value === currentPayeeValue);
                if (optionExists) {
                    payeeSelect.value = currentPayeeValue;
                } else if (isNewTransaction) {
                    const autoOptionExists = Array.from(payeeSelect.options).some(opt => opt.value === 'AUTO');
                    if (autoOptionExists) payeeSelect.value = 'AUTO';
                }
            } else if (isNewTransaction && payeeSelect) {
                const autoOptionExists = Array.from(payeeSelect.options).some(opt => opt.value === 'AUTO');
                if (autoOptionExists) payeeSelect.value = 'AUTO';
            }
            
            // Refresh custom selects
            if (this.categorySelect) this.categorySelect.refresh();
            if (this.payeeSelect) this.payeeSelect.refresh();
        };
        
        // Store handler reference and add listener
        descriptionInput._changeHandler = handler;
        descriptionInput.addEventListener('blur', handler);
    }
}
