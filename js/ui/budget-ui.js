// BudgetUI - Handles budget category display, forms, and CRUD operations
export class BudgetUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    async renderBudgetTab(onUpdateSummary) {
        console.log('💰 Rendering budget tab');
        
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
        
        if (categories.length === 0) {
            container.innerHTML = `
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
        const decryptedCategories = await Promise.all(
            categories.map(async (cat) => ({
                ...cat,
                name: await this.security.decrypt(cat.encrypted_name),
                limit: parseFloat(await this.security.decrypt(cat.encrypted_limit)),
                type: cat.type || 'Expense'
            }))
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
        
        for (const type of ['Income', 'Expense', 'Saving', 'Transfer']) {
            if (grouped[type].length === 0) continue;
            
            html += `
                <div class="budget-group">
                    <h3 class="group-header ${typeColors[type]}">${type}</h3>
            `;
            
            for (const cat of grouped[type]) {
                const tracked = await this.calculateCategoryTracked(cat.id);
                const isTransfer = cat.type === 'Transfer';
                const percentage = cat.limit > 0 ? Math.min(100, (tracked / cat.limit) * 100) : 0;
                const remaining = cat.limit - tracked;
                
                html += `
                    <div class="category-card ${cardColors[type]}" data-id="${cat.id}">
                        <div class="category-header">
                            <span class="category-name">${cat.name}</span>
                            <span class="category-amount">$${cat.limit.toFixed(2)}</span>
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
        
        // Add FAB
        html += `
            <button class="fab" id="fab-add-category" title="Add Category">
                <i data-lucide="plus"></i>
            </button>
        `;
        
        container.innerHTML = html;
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async updateSummaryCards() {
        console.log('📊 Updating summary cards');
        
        const categories = await this.db.getAllCategories();
        
        let budgetedIncome = 0;
        let budgetedOutflow = 0;
        
        // Calculate budgeted totals by category type
        for (const category of categories) {
            const limit = parseFloat(await this.security.decrypt(category.encrypted_limit));
            const categoryType = category.type || 'Expense';
            
            if (categoryType === 'Income') {
                budgetedIncome += limit;
            } else if (categoryType === 'Expense' || categoryType === 'Saving') {
                budgetedOutflow += limit;
            }
        }
        
        // Calculate remaining
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
            const limit = await this.security.decrypt(category.encrypted_limit);
            
            document.getElementById('category-modal-title').textContent = 'Edit Category';
            document.getElementById('category-name').value = name;
            document.getElementById('category-limit').value = limit;
            document.getElementById('category-type').value = category.type || 'Expense';
            
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
        console.log('💾 Saving category...');
        
        const form = document.getElementById('category-form');
        const name = document.getElementById('category-name').value.trim();
        const limit = document.getElementById('category-limit').value;
        const type = document.getElementById('category-type').value;
        
        if (!name || !limit) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const category = {
                encrypted_name: await this.security.encrypt(name),
                encrypted_limit: await this.security.encrypt(limit),
                type: type || 'Expense'
            };
            
            if (form.dataset.editId) {
                category.id = parseInt(form.dataset.editId);
            }
            
            await this.db.saveCategory(category);
            
            document.getElementById('category-modal').classList.add('hidden');
            
            if (onSuccess) {
                await onSuccess();
            }
            
            console.log('✅ Category saved successfully');
        } catch (error) {
            console.error('❌ Save category failed:', error);
            alert('Failed to save category: ' + error.message);
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

    async calculateCategoryTracked(categoryId) {
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        let total = 0;
        
        for (const t of transactions) {
            const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
            total += Math.abs(amount);
        }
        
        return total;
    }
}
