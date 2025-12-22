class UIManager {
    constructor(securityManager, databaseManager) {
        // ...existing code...
        this.csvImporter = new CSVImporter(securityManager, databaseManager);
        this.activeMonth = new Date(); // Current month
        this.initializeMonthPicker();
    }

    initializeMonthPicker() {
        this.activeMonth = new Date();
        this.activeMonth.setDate(1); // First day of month
    }

    getCurrentMonthKey() {
        return `${this.activeMonth.getFullYear()}-${String(this.activeMonth.getMonth() + 1).padStart(2, '0')}`;
    }

    renderBottomNavigation() {
        return `
            <nav class="bottom-nav">
                <button class="nav-item" data-tab="transactions">
                    <i data-lucide="receipt"></i>
                    <span>Transactions</span>
                </button>
                <button class="nav-item" data-tab="budget">
                    <i data-lucide="wallet"></i>
                    <span>Budget</span>
                </button>
                <button class="nav-item" data-tab="mappings">
                    <i data-lucide="link"></i>
                    <span>Mappings</span>
                </button>
                <button class="nav-item" data-tab="settings">
                    <i data-lucide="settings"></i>
                    <span>Settings</span>
                </button>
            </nav>
        `;
    }

    renderAddBar() {
        return `
            <div class="add-bar">
                <div class="add-bar-content">
                    <button class="btn-add" data-action="add-transaction">
                        <i data-lucide="plus"></i>
                        Add Transaction
                    </button>
                    <button class="btn-add" data-action="import-csv">
                        <i data-lucide="upload"></i>
                        Import CSV
                    </button>
                </div>
            </div>
        `;
    }

    renderMonthPicker() {
        const monthName = this.activeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const isCurrentMonth = this.getCurrentMonthKey() === this.getTodayMonthKey();
        
        return `
            <div class="month-picker">
                <button class="btn-month-nav" data-action="prev-month">
                    <i data-lucide="chevron-left"></i>
                </button>
                <span class="month-display">${monthName}</span>
                <button class="btn-month-nav" data-action="next-month">
                    <i data-lucide="chevron-right"></i>
                </button>
                ${!isCurrentMonth ? '<button class="btn-today" data-action="today">Today</button>' : ''}
            </div>
        `;
    }

    getTodayMonthKey() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }

    async renderBudgetView() {
        const categories = await this.db.getAllCategories();
        const decryptedCategories = await Promise.all(
            categories.map(async (cat) => ({
                ...cat,
                name: await this.security.decrypt(cat.encrypted_name),
                limit: parseFloat(await this.security.decrypt(cat.encrypted_limit)),
                type: cat.type || 'Expense'
            }))
        );

        // Group and sort categories
        const grouped = {
            Income: [],
            Expense: [],
            Saving: [],
            Transfer: []
        };

        decryptedCategories.forEach(cat => {
            grouped[cat.type].push(cat);
        });

        // Sort each group by budget amount (high to low)
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => b.limit - a.limit);
        });

        const monthKey = this.getCurrentMonthKey();
        
        let html = `
            ${this.renderMonthPicker()}
            <div class="budget-container">
        `;

        // Render each group
        for (const type of ['Income', 'Expense', 'Saving', 'Transfer']) {
            if (grouped[type].length === 0) continue;
            
            html += `<div class="budget-group">
                <h3 class="group-header">${type}</h3>`;
            
            for (const cat of grouped[type]) {
                const spent = await this.calculateCategorySpent(cat.id, monthKey);
                const isTransfer = cat.type === 'Transfer';
                
                html += `
                    <div class="budget-item ${isTransfer ? 'transfer' : ''}">
                        <div class="budget-header">
                            <span class="category-name">${cat.name}</span>
                            <span class="budget-amount">$${cat.limit.toFixed(2)}</span>
                        </div>
                        ${!isTransfer ? `
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${Math.min(100, (spent / cat.limit) * 100)}%"></div>
                            </div>
                            <div class="budget-footer">
                                <span>Spent: $${spent.toFixed(2)}</span>
                                <span>Remaining: $${(cat.limit - spent).toFixed(2)}</span>
                            </div>
                        ` : `
                            <div class="transfer-note">Total: $${spent.toFixed(2)}</div>
                        `}
                    </div>
                `;
            }
            
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }

    async calculateCategorySpent(categoryId, monthKey) {
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        let total = 0;
        
        for (const t of transactions) {
            const date = await this.security.decrypt(t.encrypted_date);
            const transactionMonth = new Date(date);
            const tKey = `${transactionMonth.getFullYear()}-${String(transactionMonth.getMonth() + 1).padStart(2, '0')}`;
            
            if (tKey === monthKey) {
                const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
                total += Math.abs(amount);
            }
        }
        
        return total;
    }

    async renderCSVReviewScreen(importResults) {
        const { total, duplicates, data } = importResults;
        
        let html = `
            <div class="csv-review">
                <div class="review-header">
                    <h2>Review Import</h2>
                    <p>${total} transactions found</p>
                    ${duplicates > 0 ? `<p class="warning">${duplicates} duplicates detected</p>` : ''}
                </div>
                <div class="review-list">
        `;

        for (let i = 0; i < this.csvImporter.mappingSuggestions.length; i++) {
            const suggestion = this.csvImporter.mappingSuggestions[i];
            const isDuplicate = this.csvImporter.duplicates.some(d => d.row === suggestion.row);
            
            html += `
                <div class="review-item ${isDuplicate ? 'duplicate' : ''}" data-index="${i}">
                    <div class="item-header">
                        <input type="checkbox" ${isDuplicate ? '' : 'checked'} data-field="include">
                        <span>${suggestion.row.Description || 'No description'}</span>
                        <span class="amount">$${Math.abs(parseFloat(suggestion.row.Amount || 0)).toFixed(2)}</span>
                    </div>
                    ${isDuplicate ? '<span class="duplicate-badge">Duplicate</span>' : ''}
                    <div class="mapping-controls">
                        <select data-field="category">
                            <option value="">Select Category...</option>
                            ${await this.getCategoryOptions(suggestion.descriptionMapping)}
                        </select>
                        <label>
                            <input type="checkbox" data-field="saveMapping">
                            Save as mapping
                        </label>
                    </div>
                </div>
            `;
        }

        html += `
                </div>
                <div class="review-actions">
                    <button class="btn-cancel" data-action="cancel-import">Cancel</button>
                    <button class="btn-primary" data-action="confirm-import">Import Selected</button>
                </div>
            </div>
        `;
        
        return html;
    }

    async getCategoryOptions(suggestedMapping) {
        const categories = await this.db.getAllCategories();
        let html = '';
        
        for (const cat of categories) {
            const name = await this.security.decrypt(cat.encrypted_name);
            const selected = suggestedMapping && cat.id === parseInt(await this.security.decrypt(suggestedMapping.encrypted_category));
            html += `<option value="${cat.id}" ${selected ? 'selected' : ''}>${name}</option>`;
        }
        
        return html;
    }

    async renderMappingsView() {
        const accountMappings = await this.db.getAllAccountMappings();
        const descriptionMappings = await this.db.getAllDescriptionMappings();
        
        let html = `
            <div class="mappings-container">
                <h2>Account Mappings</h2>
                <div class="mappings-list">
        `;
        
        for (const mapping of accountMappings) {
            const name = await this.security.decrypt(mapping.encrypted_name);
            html += `
                <div class="mapping-item">
                    <span class="mapping-key">${mapping.account_number}</span>
                    <span class="mapping-value">${name}</span>
                    <button class="btn-delete" data-action="delete-account-mapping" data-key="${mapping.account_number}">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
        }
        
        html += `
                </div>
                <h2>Description Mappings</h2>
                <div class="mappings-list">
        `;
        
        for (const mapping of descriptionMappings) {
            const category = await this.security.decrypt(mapping.encrypted_category);
            const payee = await this.security.decrypt(mapping.encrypted_payee);
            html += `
                <div class="mapping-item">
                    <span class="mapping-key">${mapping.description}</span>
                    <span class="mapping-value">Cat: ${category}, Payee: ${payee}</span>
                    <button class="btn-delete" data-action="delete-description-mapping" data-key="${mapping.description}">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    // ...existing code...
}