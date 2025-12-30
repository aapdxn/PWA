/**
 * Budget Category Form - Handles category CRUD modals and operations
 * 
 * @module BudgetCategoryForm
 */

export class BudgetCategoryForm {
    constructor(security, db, monthManager) {
        this.security = security;
        this.db = db;
        this.monthManager = monthManager;
        
        // Callback for when category is saved/deleted
        this.onCategoryChanged = null;
    }

    /**
     * Open category modal for editing or creating
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
     * Populate form for editing existing category
     */
    async _populateEditForm(categoryId, form) {
        const category = await this.db.getCategory(categoryId);
        
        if (!category) {
            alert('Category not found');
            return;
        }
        
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
     * Reset form for creating new category
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
     * Save category (create or update)
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
     * Delete category
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
     * Set monthly budget for a category (quick edit)
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
     * Show copy from month modal
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
     * Close category modal
     */
    _closeModal() {
        document.getElementById('category-modal').classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}
