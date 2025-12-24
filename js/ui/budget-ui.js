// BudgetUI - Handles budget category display, forms, and CRUD operations
export class BudgetUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
        
        // Month navigation state
        const now = new Date();
        this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    async renderBudgetTab(onUpdateSummary) {
        console.log('💰 Rendering budget tab for month:', this.currentMonth);
        
        // Update summary cards
        if (onUpdateSummary) {
            await onUpdateSummary();
        }
        
        const categories = await this.db.getAllCategories();
        const container = document.getElementById('budget-list');
        
        if (!container) {
            console.error('❌ Budget list container not found');
            return;
        }
        
        // Add month navigation header
        const monthName = this.getMonthName(this.currentMonth);
        const isCurrentMonth = this.isCurrentMonth(this.currentMonth);
        
        let monthHeader = `
            <div style="position: sticky; top: 0; z-index: 10; background: var(--bg-secondary); padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
                <button class="icon-btn" id="budget-prev-month" title="Previous Month">
                    <i data-lucide="chevron-left"></i>
                </button>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <h2 style="margin: 0; font-size: 1.125rem; font-weight: 600;">${monthName}</h2>
                    ${!isCurrentMonth ? `<button class="icon-btn" id="budget-current-month" title="Go to current month" style="padding: 6px 12px; font-size: 0.875rem;"><i data-lucide="calendar-days" style="width: 16px; height: 16px;"></i></button>` : ''}
                </div>
                <button class="icon-btn" id="budget-next-month" title="Next Month">
                    <i data-lucide="chevron-right"></i>
                </button>
            </div>
        `;
        
        if (categories.length === 0) {
            container.innerHTML = monthHeader + `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="wallet" style="width: 64px; height: 64px;"></i>
                    </div>
                    <h3>No Categories Yet</h3>
                    <p>Create your first budget category to get started</p>
                    <button class="btn-primary" id="fab-add-category-inline">
                        <i data-lucide="plus"></i>
                        <span>Add Category</span>
                    </button>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Decrypt and group categories
        const monthlyBudgets = await this.db.getCategoryBudgetsForMonth(this.currentMonth);
        const decryptedCategories = await Promise.all(
            categories.map(async (cat) => {
                // Only use monthly budget - no default fallback
                const monthlyBudget = monthlyBudgets.find(mb => mb.categoryId === cat.id);
                const limit = monthlyBudget 
                    ? parseFloat(await this.security.decrypt(monthlyBudget.encrypted_limit))
                    : 0; // No budget set for this month
                
                return {
                    ...cat,
                    name: await this.security.decrypt(cat.encrypted_name),
                    limit: limit,
                    type: cat.type || 'Expense',
                    hasMonthlyOverride: !!monthlyBudget
                };
            })
        );
        
        const grouped = {
            Income: [],
            Expense: [],
            Saving: [],
            Transfer: []
        };
        
        decryptedCategories.forEach(cat => {
            grouped[cat.type].push(cat);
        });
        
        // Sort by limit
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => b.limit - a.limit);
        });
        
        let html = '';
        const typeColors = {
            Income: 'income-header',
            Expense: 'expense-header',
            Saving: 'saving-header',
            Transfer: 'transfer-header'
        };
        
        const cardColors = {
            Income: 'income-card',
            Expense: 'expense-card',
            Saving: 'saving-card',
            Transfer: 'transfer'
        };
        
        html = monthHeader;
        
        for (const type of ['Income', 'Expense', 'Saving', 'Transfer']) {
            if (grouped[type].length === 0) continue;
            
            html += `
                <div class="budget-group">
                    <h3 class="group-header ${typeColors[type]}">${type}</h3>
            `;
            
            for (const cat of grouped[type]) {
                const tracked = await this.calculateCategoryTracked(cat.id, this.currentMonth);
                const isTransfer = cat.type === 'Transfer';
                const percentage = cat.limit > 0 ? Math.min(100, (tracked / cat.limit) * 100) : 0;
                const remaining = cat.limit - tracked;
                
                html += `
                    <div class="category-card ${cardColors[type]}" data-id="${cat.id}" style="cursor: pointer;" onclick="window.budgetUI?.openCategoryModal(${cat.id})">
                        <div class="category-header">
                            <span class="category-name">${cat.name}</span>
                            <span class="category-amount" style="cursor: pointer; ${cat.hasMonthlyOverride ? 'text-decoration: underline; font-weight: 700;' : ''}" onclick="event.stopPropagation(); window.budgetUI?.setMonthlyBudget(${cat.id}, ${cat.limit});" title="${cat.hasMonthlyOverride ? 'Custom budget for this month (click to change)' : 'Click to set custom budget for this month'}">$${cat.limit.toFixed(2)}</span>
                        </div>
                        ${!isTransfer ? `
                            <div class="progress-bar">
                                <div class="progress-fill ${percentage > 100 ? 'over-budget' : ''}" 
                                     style="width: ${Math.min(100, percentage)}%"></div>
                            </div>
                            <div class="category-footer">
                                <span class="footer-label">Tracked</span>
                                <span class="footer-value">$${tracked.toFixed(2)}</span>
                                <span class="footer-label">Remaining</span>
                                <span class="footer-value ${remaining < 0 ? 'negative' : ''}">
                                    $${remaining.toFixed(2)}
                                </span>
                            </div>
                        ` : `
                            <div class="transfer-note">Total: $${tracked.toFixed(2)}</div>
                        `}
                    </div>
                `;
            }
            
            html += `</div>`;
        }
        
        // Add FAB with menu
        html += `
            <div class="fab-menu hidden" id="fab-budget-menu">
                <button class="fab-menu-item" id="fab-add-category-btn">
                    <i data-lucide="plus-circle"></i>
                    <span>Add Category</span>
                </button>
                <button class="fab-menu-item" id="fab-copy-month">
                    <i data-lucide="copy"></i>
                    <span>Copy from Month</span>
                </button>
            </div>
            <button class="fab" id="fab-budget" title="Budget Actions">
                <i data-lucide="plus"></i>
            </button>
        `;
        
        container.innerHTML = html;
        
        // Attach month navigation listeners
        const prevBtn = document.getElementById('budget-prev-month');
        const nextBtn = document.getElementById('budget-next-month');
        const currentBtn = document.getElementById('budget-current-month');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.changeMonth(-1, onUpdateSummary));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.changeMonth(1, onUpdateSummary));
        }
        if (currentBtn) {
            currentBtn.addEventListener('click', () => {
                const now = new Date();
                this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                this.renderBudgetTab(onUpdateSummary);
            });
        }
        
        // Attach FAB menu listeners
        const fabBtn = document.getElementById('fab-budget');
        const fabMenu = document.getElementById('fab-budget-menu');
        const copyMonthBtn = document.getElementById('fab-copy-month');
        
        if (fabBtn && fabMenu) {
            fabBtn.addEventListener('click', () => {
                fabMenu.classList.toggle('hidden');
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#fab-budget') && !e.target.closest('#fab-budget-menu')) {
                    fabMenu.classList.add('hidden');
                }
            });
        }
        
        if (copyMonthBtn) {
            copyMonthBtn.addEventListener('click', () => {
                fabMenu.classList.add('hidden');
                this.showCopyFromMonthModal(onUpdateSummary);
            });
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async updateSummaryCards() {
        console.log('📊 Updating summary cards for month:', this.currentMonth);
        
        const categories = await this.db.getAllCategories();
        const monthlyBudgets = await this.db.getCategoryBudgetsForMonth(this.currentMonth);
        
        let budgetedIncome = 0;
        let budgetedOutflow = 0;
        let trackedIncome = 0;
        let trackedOutflow = 0;
        
        // Calculate budgeted and tracked totals by category type for the selected month
        for (const category of categories) {
            // Get monthly budget (not default)
            const monthlyBudget = monthlyBudgets.find(mb => mb.categoryId === category.id);
            const limit = monthlyBudget 
                ? parseFloat(await this.security.decrypt(monthlyBudget.encrypted_limit))
                : 0;
            
            const categoryType = category.type || 'Expense';
            
            // Get tracked amount for this month
            const tracked = await this.calculateCategoryTracked(category.id, this.currentMonth);
            
            if (categoryType === 'Income') {
                budgetedIncome += limit;
                trackedIncome += tracked;
            } else if (categoryType === 'Expense' || categoryType === 'Saving') {
                budgetedOutflow += limit;
                trackedOutflow += tracked;
            }
        }
        
        // Calculate remaining (based on budgeted, not tracked)
        const remaining = budgetedIncome - budgetedOutflow;
        
        // Update the DOM
        const incomeCard = document.querySelector('.summary-card.income .summary-value');
        const outflowCard = document.querySelector('.summary-card.spent .summary-value');
        const remainingCard = document.querySelector('.summary-card.remaining');
        const remainingValue = document.querySelector('.summary-card.remaining .summary-value');
        
        if (incomeCard) incomeCard.textContent = `$${budgetedIncome.toFixed(2)}`;
        if (outflowCard) outflowCard.textContent = `$${budgetedOutflow.toFixed(2)}`;
        if (remainingValue) remainingValue.textContent = `$${Math.abs(remaining).toFixed(2)}`;
        
        // Add negative class if remaining is not zero (makes it red)
        if (remainingCard) {
            if (remaining !== 0) {
                remainingCard.classList.add('negative');
            } else {
                remainingCard.classList.remove('negative');
            }
        }
    }

    async openCategoryModal(categoryId = null) {
        console.log('📝 Opening category modal, ID:', categoryId);
        
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('category-form');
        
        if (!modal) {
            console.error('❌ Category modal not found!');
            return;
        }
        
        if (categoryId) {
            const category = await this.db.getCategory(categoryId);
            
            if (!category) {
                alert('Category not found');
                return;
            }
            
            const name = await this.security.decrypt(category.encrypted_name);
            
            // Get monthly budget for current month, not default limit
            const monthlyBudget = await this.db.getCategoryBudget(categoryId, this.currentMonth);
            const limit = monthlyBudget 
                ? await this.security.decrypt(monthlyBudget.encrypted_limit)
                : '0';
            
            const monthName = this.getMonthName(this.currentMonth);
            document.getElementById('category-modal-title').textContent = `Edit Budget - ${monthName}`;
            document.getElementById('category-name').value = name;
            document.getElementById('category-name').readOnly = true;
            document.getElementById('category-name').style.opacity = '0.6';
            document.getElementById('category-limit').value = limit;
            document.getElementById('category-type').value = category.type || 'Expense';
            document.getElementById('category-type').disabled = true;
            document.getElementById('category-type').style.opacity = '0.6';
            
            form.dataset.editId = categoryId;
            
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
            
            const saveBtn = document.getElementById('category-form-submit');
            if (saveBtn) {
                saveBtn.innerHTML = '<i data-lucide="check"></i>';
                saveBtn.title = 'Save';
            }
        } else {
            document.getElementById('category-modal-title').textContent = 'Add Category';
            form.reset();
            delete form.dataset.editId;
            
            // Re-enable fields for new category
            document.getElementById('category-name').readOnly = false;
            document.getElementById('category-name').style.opacity = '1';
            document.getElementById('category-type').disabled = false;
            document.getElementById('category-type').style.opacity = '1';
            
            const deleteBtn = document.getElementById('delete-category-btn');
            if (deleteBtn) {
                deleteBtn.classList.add('hidden');
            }
            
            const saveBtn = document.getElementById('category-form-submit');
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

    async saveCategory(onSuccess) {
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
                await this.db.setCategoryBudget(categoryId, this.currentMonth, encryptedLimit);
                
                console.log(`✅ Updated monthly budget for ${name} in ${this.currentMonth}`);
            } else {
                // Creating new category - set both default and monthly budget
                const categoryId = await this.db.saveCategory({
                    encrypted_name: await this.security.encrypt(name),
                    encrypted_limit: await this.security.encrypt(limit),
                    type: type || 'Expense'
                });
                
                // Also set monthly budget for current month
                const encryptedLimit = await this.security.encrypt(limit);
                await this.db.setCategoryBudget(categoryId, this.currentMonth, encryptedLimit);
                
                console.log(`✅ Created new category ${name} with budget for ${this.currentMonth}`);
            }
            
            document.getElementById('category-modal').classList.add('hidden');
            
            if (onSuccess) {
                await onSuccess();
            }
        } catch (error) {
            console.error('❌ Save category/budget failed:', error);
            alert('Failed to save: ' + error.message);
        }
    }

    async deleteCategory(categoryId, onSuccess) {
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
            document.getElementById('category-modal').classList.add('hidden');
            
            if (onSuccess) {
                await onSuccess();
            }
            
            console.log('✅ Category deleted');
        } catch (error) {
            console.error('❌ Delete category failed:', error);
            alert('Failed to delete category: ' + error.message);
        }
    }

    async calculateCategoryTracked(categoryId, month = null) {
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        let total = 0;
        
        for (const t of transactions) {
            // Filter by month if provided
            if (month) {
                const transactionDate = await this.security.decrypt(t.encrypted_date);
                const transactionMonth = transactionDate.substring(0, 7); // YYYY-MM
                if (transactionMonth !== month) continue;
            }
            
            const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
            total += Math.abs(amount);
        }
        
        return total;
    }
    
    changeMonth(offset, onUpdateSummary) {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        this.currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        this.renderBudgetTab(onUpdateSummary);
    }
    
    getMonthName(monthString) {
        const [year, month] = monthString.split('-');
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    isCurrentMonth(monthString) {
        const now = new Date();
        const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return monthString === current;
    }
    
    async setMonthlyBudget(categoryId, currentLimit) {
        const category = await this.db.getCategory(categoryId);
        if (!category) return;
        
        const categoryName = await this.security.decrypt(category.encrypted_name);
        const monthName = this.getMonthName(this.currentMonth);
        
        const newLimit = prompt(
            `Set budget for ${categoryName} in ${monthName}:\n\nCurrent: $${currentLimit.toFixed(2)}\nEnter new amount (or leave blank to use default):`,
            currentLimit.toFixed(2)
        );
        
        if (newLimit === null) return; // Cancelled
        
        if (newLimit.trim() === '') {
            // Remove monthly override
            const existingBudget = await this.db.getCategoryBudget(categoryId, this.currentMonth);
            if (existingBudget) {
                await this.db.db.category_budgets.delete([categoryId, this.currentMonth]);
            }
        } else {
            const limitValue = parseFloat(newLimit);
            if (isNaN(limitValue) || limitValue < 0) {
                alert('Please enter a valid positive number');
                return;
            }
            
            const encryptedLimit = await this.security.encrypt(limitValue.toString());
            await this.db.setCategoryBudget(categoryId, this.currentMonth, encryptedLimit);
        }
        
        await this.renderBudgetTab();
    }
    
    async showCopyFromMonthModal(onUpdateSummary) {
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
                                This will copy all budget amounts from the selected month to <strong>${this.getMonthName(this.currentMonth)}</strong>.
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
            
            if (sourceMonth === this.currentMonth) {
                alert('Cannot copy from the same month!');
                return;
            }
            
            try {
                // Get budgets from source month
                const sourceBudgets = await this.db.getCategoryBudgetsForMonth(sourceMonth);
                
                if (sourceBudgets.length === 0) {
                    alert(`No budgets found for ${this.getMonthName(sourceMonth)}`);
                    return;
                }
                
                // Copy each budget to current month
                for (const budget of sourceBudgets) {
                    await this.db.setCategoryBudget(
                        budget.categoryId, 
                        this.currentMonth, 
                        budget.encrypted_limit
                    );
                }
                
                closeModal();
                await this.renderBudgetTab(onUpdateSummary);
                
                console.log(`✅ Copied ${sourceBudgets.length} budgets from ${sourceMonth} to ${this.currentMonth}`);
            } catch (error) {
                console.error('❌ Copy budgets failed:', error);
                alert('Failed to copy budgets: ' + error.message);
            }
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}
