/**
 * BudgetCategoryForm - Category CRUD Modal Handler
 * 
 * RESPONSIBILITIES:
 * - Render and manage category creation/edit modals
 * - Handle category save, update, and delete operations
 * - Manage monthly budget overrides (quick-edit)
 * - Handle "Copy from Month" functionality
 * - Validate form inputs before saving
 * 
 * FORM MODES:
 * - Create Mode: All fields editable (name, type, limit)
 * - Edit Mode: Name/type read-only, limit editable for current month
 * 
 * VALIDATION RULES:
 * - Category name: Required, non-empty
 * - Budget limit: Required, must be valid positive number
 * - Category type: Income, Expense, Saving, or Transfer
 * - Delete: Prevented if category has assigned transactions
 * 
 * CATEGORY TYPES:
 * - Income: Positive amounts, increases available budget
 * - Expense: Negative amounts, decreases available budget
 * - Saving: Negative amounts, treated like expense
 * - Transfer: No budget tracking, excluded from calculations
 * 
 * STATE REQUIREMENTS:
 * - Requires Unlocked state for all decrypt operations
 * 
 * @class BudgetCategoryForm
 * @module UI/Budget
 * @layer 5 - UI Components
 */

export class BudgetCategoryForm {
    /**
     * Initialize category form manager with dependency injection
     * 
     * @param {SecurityManager} security - Web Crypto API wrapper for encryption/decryption
     * @param {DatabaseManager} db - Dexie database wrapper for CRUD operations
     * @param {BudgetMonthManager} monthManager - Month navigation manager for current month context
     */
    constructor(security, db, monthManager) {
        this.security = security;
        this.db = db;
        this.monthManager = monthManager;
        
        // Callback for when category is saved/deleted
        this.onCategoryChanged = null;
    }

    /**
     * Open category modal in create or edit mode
     * 
     * CREATE MODE (categoryId = null):
     * - All fields enabled and editable
     * - Delete button hidden
     * - Save creates new category + sets monthly budget
     * 
     * EDIT MODE (categoryId provided):
     * - Name and type fields are read-only (immutable)
     * - Budget limit editable for current month only
     * - Delete button visible if no transactions assigned
     * - Save updates monthly budget (not default limit)
     * 
     * @param {number|null} [categoryId=null] - Category ID to edit, or null to create new
     * @returns {Promise<void>}
     */
    async openCategoryModal(categoryId = null) {
        console.log('📝 Opening category modal, ID:', categoryId);
        
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('category-form');
        
        if (!modal) {
            console.error('❌ Category modal not found!');
            return;
        }
        
        if (categoryId) {
            await this._populateEditForm(categoryId, form);
        } else {
            this._resetFormForCreate(form);
        }
        
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Populate form fields for editing existing category
     * 
     * IMPORTANT: Loads monthly budget for current month, NOT default limit
     * This allows per-month budget customization while preserving category definition.
     * 
     * FIELD STATES:
     * - Name: Read-only (cannot change category name after creation)
     * - Type: Disabled (cannot change Income/Expense type after creation)
     * - Limit: Editable (sets monthly budget for current month)
     * 
     * @private
     * @param {number} categoryId - Category ID to load data for
     * @param {HTMLFormElement} form - Form element to populate
     * @returns {Promise<void>}
     */
    async _populateEditForm(categoryId, form) {
        const category = await this.db.getCategory(categoryId);
        
        if (!category) {
            alert('Category not found');
            return;
        }
        
        // STATE GUARD: Decrypt requires unlocked state
        const name = await this.security.decrypt(category.encrypted_name);
        
        // Get monthly budget for current month, not default limit
        const monthlyBudget = await this.db.getCategoryBudget(categoryId, this.monthManager.currentMonth);
        const limit = monthlyBudget 
            ? await this.security.decrypt(monthlyBudget.encrypted_limit)
            : '0';
        
        const monthName = this.monthManager.getMonthName(this.monthManager.currentMonth);
        document.getElementById('category-modal-title').textContent = `Edit Budget - ${monthName}`;
        document.getElementById('category-name').value = name;
        document.getElementById('category-name').readOnly = true;
        document.getElementById('category-name').style.opacity = '0.6';
        document.getElementById('category-limit').value = limit;
        document.getElementById('category-type').value = category.type || 'Expense';
        document.getElementById('category-type').disabled = true;
        document.getElementById('category-type').style.opacity = '0.6';
        
        form.dataset.editId = categoryId;
        
        // Show delete button
        let deleteBtn = document.getElementById('delete-category-btn');
        if (!deleteBtn) {
            deleteBtn = document.createElement('button');
            deleteBtn.id = 'delete-category-btn';
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
        
        // Update save button
        const saveBtn = document.getElementById('category-form-submit');
        if (saveBtn) {
            saveBtn.innerHTML = '<i data-lucide="check"></i>';
            saveBtn.title = 'Save';
        }
    }

    /**
     * Reset form to default state for creating new category
     * 
     * Clears all fields, removes edit ID, enables all inputs,
     * and hides delete button.
     * 
     * @private
     * @param {HTMLFormElement} form - Form element to reset
     */
    _resetFormForCreate(form) {
        document.getElementById('category-modal-title').textContent = 'Add Category';
        form.reset();
        delete form.dataset.editId;
        
        // Re-enable fields for new category
        document.getElementById('category-name').readOnly = false;
        document.getElementById('category-name').style.opacity = '1';
        document.getElementById('category-type').disabled = false;
        document.getElementById('category-type').style.opacity = '1';
        
        // Hide delete button
        const deleteBtn = document.getElementById('delete-category-btn');
        if (deleteBtn) {
            deleteBtn.classList.add('hidden');
        }
        
        // Update save button
        const saveBtn = document.getElementById('category-form-submit');
        if (saveBtn) {
            saveBtn.innerHTML = 'Save';
            saveBtn.title = '';
        }
    }

    /**
     * Save category (create new or update monthly budget)
     * 
     * CREATE MODE:
     * 1. Validates all fields (name, limit, type)
     * 2. Encrypts and saves new category with default limit
     * 3. Sets monthly budget for current month
     * 4. Triggers onCategoryChanged callback
     * 
     * EDIT MODE:
     * 1. Validates budget limit only
     * 2. Updates monthly budget for current month
     * 3. Does NOT modify category name or type (immutable)
     * 4. Triggers onCategoryChanged callback
     * 
     * VALIDATION:
     * - Name must be non-empty (create only)
     * - Limit must be valid number ≥ 0
     * 
     * @returns {Promise<void>}
     */
    async saveCategory() {
        console.log('💾 Saving category/budget...');
        
        const form = document.getElementById('category-form');
        const name = document.getElementById('category-name').value.trim();
        const limit = document.getElementById('category-limit').value;
        const type = document.getElementById('category-type').value;
        
        if (!name || !limit) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            if (form.dataset.editId) {
                // Editing existing category - update monthly budget only (name/type are read-only)
                const categoryId = parseInt(form.dataset.editId);
                
                // Save monthly budget for current month
                const encryptedLimit = await this.security.encrypt(limit);
                await this.db.setCategoryBudget(categoryId, this.monthManager.currentMonth, encryptedLimit);
                
                console.log(`✅ Updated monthly budget for ${name} in ${this.monthManager.currentMonth}`);
            } else {
                // Creating new category - set both default and monthly budget
                const categoryId = await this.db.saveCategory({
                    encrypted_name: await this.security.encrypt(name),
                    encrypted_limit: await this.security.encrypt(limit),
                    type: type || 'Expense'
                });
                
                // Also set monthly budget for current month
                const encryptedLimit = await this.security.encrypt(limit);
                await this.db.setCategoryBudget(categoryId, this.monthManager.currentMonth, encryptedLimit);
                
                console.log(`✅ Created new category ${name} with budget for ${this.monthManager.currentMonth}`);
            }
            
            this._closeModal();
            
            if (this.onCategoryChanged) {
                await this.onCategoryChanged();
            }
        } catch (error) {
            console.error('❌ Save category/budget failed:', error);
            alert('Failed to save: ' + error.message);
        }
    }

    /**
     * Delete category after validation and confirmation
     * 
     * VALIDATION:
     * - Prevents deletion if category has assigned transactions
     * - User must reassign or delete transactions first
     * - Requires user confirmation via confirm() dialog
     * 
     * ON SUCCESS:
     * - Deletes category from database
     * - Closes modal
     * - Triggers onCategoryChanged callback to refresh UI
     * 
     * @param {number} categoryId - Category ID to delete
     * @returns {Promise<void>}
     */
    async deleteCategory(categoryId) {
        console.log('🗑️ Deleting category:', categoryId);
        
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        
        if (transactions.length > 0) {
            alert(`This category has ${transactions.length} transaction(s). Please reassign or delete them first.`);
            return;
        }
        
        if (!confirm('Are you sure you want to delete this category?')) {
            return;
        }
        
        try {
            await this.db.deleteCategory(categoryId);
            this._closeModal();
            
            if (this.onCategoryChanged) {
                await this.onCategoryChanged();
            }
            
            console.log('✅ Category deleted');
        } catch (error) {
            console.error('❌ Delete category failed:', error);
            alert('Failed to delete category: ' + error.message);
        }
    }

    /**
     * Quick-edit monthly budget for a category
     * 
     * Shows prompt to set custom budget override for current month.
     * Allows resetting to default by clearing the value.
     * 
     * BEHAVIOR:
     * - If user enters amount: Sets monthly budget override
     * - If user clears value: Removes override, uses default limit
     * - If user cancels: No changes made
     * 
     * MONTHLY BUDGETS:
     * - Stored separately from default category limit
     * - Allows per-month customization without changing category definition
     * - Indicated by underline in UI
     * 
     * @param {number} categoryId - Category to set budget for
     * @param {number} currentLimit - Current budget amount to display in prompt
     * @returns {Promise<void>}
     */
    async setMonthlyBudget(categoryId, currentLimit) {
        const category = await this.db.getCategory(categoryId);
        if (!category) return;
        
        const categoryName = await this.security.decrypt(category.encrypted_name);
        const monthName = this.monthManager.getMonthName(this.monthManager.currentMonth);
        
        const newLimit = prompt(
            `Set budget for ${categoryName} in ${monthName}:\n\nCurrent: $${currentLimit.toFixed(2)}\nEnter new amount (or leave blank to use default):`,
            currentLimit.toFixed(2)
        );
        
        if (newLimit === null) return; // Cancelled
        
        if (newLimit.trim() === '') {
            // Remove monthly override
            const existingBudget = await this.db.getCategoryBudget(categoryId, this.monthManager.currentMonth);
            if (existingBudget) {
                await this.db.db.category_budgets.delete([categoryId, this.monthManager.currentMonth]);
            }
        } else {
            const limitValue = parseFloat(newLimit);
            if (isNaN(limitValue) || limitValue < 0) {
                alert('Please enter a valid positive number');
                return;
            }
            
            const encryptedLimit = await this.security.encrypt(limitValue.toString());
            await this.db.setCategoryBudget(categoryId, this.monthManager.currentMonth, encryptedLimit);
        }
        
        if (this.onCategoryChanged) {
            await this.onCategoryChanged();
        }
    }

    /**
     * Show modal to copy all budgets from another month
     * 
     * Allows bulk copying of all monthly budget overrides from
     * a source month to the current month. Useful for establishing
     * budgets based on previous months.
     * 
     * PROCESS:
     * 1. User selects source year and month
     * 2. Fetches all category_budgets for source month
     * 3. Copies each budget to current month
     * 4. Refreshes UI to show new budgets
     * 
     * VALIDATION:
     * - Prevents copying from same month
     * - Shows alert if source month has no budgets
     * 
     * @returns {Promise<void>}
     */
    async showCopyFromMonthModal() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthNum = now.getMonth() + 1;
        
        // Generate year options (5 years back)
        const years = [];
        for (let i = 0; i < 5; i++) {
            years.push(currentYear - i);
        }
        
        // Generate month options
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        const modalHTML = `
            <div class="modal-overlay" id="copy-month-modal">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Copy Budget from Month</h3>
                        <button class="icon-btn close-modal" id="close-copy-modal">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <form id="copy-month-form">
                        <div class="input-group">
                            <label for="copy-year">Year</label>
                            <select id="copy-year" required>
                                ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="copy-month">Month</label>
                            <select id="copy-month" required>
                                ${monthNames.map((name, idx) => 
                                    `<option value="${idx + 1}" ${(idx + 1) === currentMonthNum ? 'selected' : ''}>${name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 16px;">
                            <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                                This will copy all budget amounts from the selected month to <strong>${this.monthManager.getMonthName(this.monthManager.currentMonth)}</strong>.
                            </p>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="cancel-copy">Cancel</button>
                            <button type="submit" class="btn btn-primary">Copy Budgets</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('copy-month-modal');
        const form = document.getElementById('copy-month-form');
        
        // Close handlers
        const closeModal = () => {
            modal.remove();
        };
        
        document.getElementById('close-copy-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-copy').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const year = document.getElementById('copy-year').value;
            const month = String(document.getElementById('copy-month').value).padStart(2, '0');
            const sourceMonth = `${year}-${month}`;
            
            if (sourceMonth === this.monthManager.currentMonth) {
                alert('Cannot copy from the same month!');
                return;
            }
            
            try {
                // Get budgets from source month
                const sourceBudgets = await this.db.getCategoryBudgetsForMonth(sourceMonth);
                
                if (sourceBudgets.length === 0) {
                    alert(`No budgets found for ${this.monthManager.getMonthName(sourceMonth)}`);
                    return;
                }
                
                // Copy each budget to current month
                for (const budget of sourceBudgets) {
                    await this.db.setCategoryBudget(
                        budget.categoryId, 
                        this.monthManager.currentMonth, 
                        budget.encrypted_limit
                    );
                }
                
                closeModal();
                
                if (this.onCategoryChanged) {
                    await this.onCategoryChanged();
                }
                
                console.log(`✅ Copied ${sourceBudgets.length} budgets from ${sourceMonth} to ${this.monthManager.currentMonth}`);
            } catch (error) {
                console.error('❌ Copy budgets failed:', error);
                alert('Failed to copy budgets: ' + error.message);
            }
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Close category modal and cleanup
     * 
     * @private
     */
    _closeModal() {
        document.getElementById('category-modal').classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}
