// Main Application Controller
class App {
    constructor() {
        // Wait for dependencies to load
        this.waitForDependencies().then(() => {
            this.security = new SecurityManager();
            this.db = new DatabaseManager();
            this.csvImporter = new CSVImporter(this.security, this.db);
            this.currentTab = 'transactions';
            this.appState = 'loading';
            this.activeMonth = new Date();
            this.activeMonth.setDate(1);
            
            this.init();
        });
    }

    async waitForDependencies() {
        return new Promise((resolve) => {
            const checkDeps = setInterval(() => {
                if (typeof Dexie !== 'undefined' && 
                    typeof Papa !== 'undefined' && 
                    typeof lucide !== 'undefined') {
                    clearInterval(checkDeps);
                    resolve();
                }
            }, 50);
        });
    }

    async init() {
        await this.checkAppState();
        this.attachEventListeners();
        this.render();
    }

    async checkAppState() {
        const passwordHash = await this.db.getSetting('passwordHash');
        
        if (!passwordHash) {
            this.appState = 'setup';
        } else {
            this.appState = 'locked';
        }
    }

    attachEventListeners() {
        // Setup screen
        const setupBtn = document.getElementById('setup-submit');
        if (setupBtn) {
            setupBtn.addEventListener('click', async () => {
                const password = document.getElementById('setup-password').value;
                const confirm = document.getElementById('setup-password-confirm').value;
                const errorEl = document.getElementById('setup-error');
                
                if (password !== confirm) {
                    errorEl.textContent = 'Passwords do not match';
                    errorEl.classList.remove('hidden');
                    return;
                }
                
                if (password.length < 8) {
                    errorEl.textContent = 'Password must be at least 8 characters';
                    errorEl.classList.remove('hidden');
                    return;
                }
                
                const { hash, salt } = await this.security.createPasswordHash(password);
                await this.db.saveSetting('passwordHash', hash);
                await this.db.saveSetting('passwordSalt', salt);
                await this.security.initializeEncryption(password, salt);
                
                this.appState = 'unlocked';
                this.render();
            });
        }

        // Unlock screen
        const unlockBtn = document.getElementById('unlock-submit');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', async () => {
                const password = document.getElementById('unlock-password').value;
                const errorEl = document.getElementById('unlock-error');
                
                const storedHash = (await this.db.getSetting('passwordHash')).value;
                const storedSalt = (await this.db.getSetting('passwordSalt')).value;
                
                const isValid = await this.security.verifyPassword(password, storedHash, storedSalt);
                
                if (!isValid) {
                    errorEl.textContent = 'Incorrect password';
                    errorEl.classList.remove('hidden');
                    return;
                }
                
                await this.security.initializeEncryption(password, storedSalt);
                this.appState = 'unlocked';
                this.render();
            });
        }

        // Navigation
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                navItem.classList.add('active');
                this.currentTab = navItem.dataset.tab;
                this.showTab(this.currentTab);
            }
        });

        // Month navigation
        const prevMonth = document.getElementById('prev-month');
        if (prevMonth) {
            prevMonth.addEventListener('click', () => {
                this.activeMonth.setMonth(this.activeMonth.getMonth() - 1);
                this.renderBudgetView();
            });
        }

        const nextMonth = document.getElementById('next-month');
        if (nextMonth) {
            nextMonth.addEventListener('click', () => {
                this.activeMonth.setMonth(this.activeMonth.getMonth() + 1);
                this.renderBudgetView();
            });
        }

        const returnToday = document.getElementById('return-today');
        if (returnToday) {
            returnToday.addEventListener('click', () => {
                this.activeMonth = new Date();
                this.activeMonth.setDate(1);
                this.renderBudgetView();
            });
        }

        // CSV Import
        const importBtn = document.getElementById('import-csv-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.multiple = true;
                input.onchange = async (e) => {
                    const files = Array.from(e.target.files);
                    const results = await this.csvImporter.processCSVFiles(files);
                    this.showCSVReview(results);
                };
                input.click();
            });
        }
    }

    render() {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
        
        if (this.appState === 'setup') {
            document.getElementById('setup-screen').classList.remove('hidden');
        } else if (this.appState === 'locked') {
            document.getElementById('locked-screen').classList.remove('hidden');
        } else if (this.appState === 'unlocked') {
            document.getElementById('dashboard-screen').classList.remove('hidden');
            this.renderDashboard();
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async renderDashboard() {
        this.showTab(this.currentTab);
        await this.updateSummaryCards();
    }

    showTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        if (tabName === 'budget') {
            this.renderBudgetView();
        } else if (tabName === 'transactions') {
            this.renderTransactionsList();
        } else if (tabName === 'mappings') {
            this.renderMappingsView();
        }
    }

    async updateSummaryCards() {
        const categories = await this.db.getAllCategories();
        let totalBudget = 0;
        let totalSpent = 0;
        
        for (const cat of categories) {
            if (cat.type !== 'Transfer') {
                const limit = parseFloat(await this.security.decrypt(cat.encrypted_limit));
                totalBudget += limit;
            }
        }
        
        const transactions = await this.db.getAllTransactions();
        for (const t of transactions) {
            const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
            totalSpent += Math.abs(amount);
        }
        
        document.getElementById('total-budget').textContent = `$${totalBudget.toFixed(2)}`;
        document.getElementById('total-spent').textContent = `$${totalSpent.toFixed(2)}`;
        document.getElementById('total-remaining').textContent = `$${(totalBudget - totalSpent).toFixed(2)}`;
    }

    async renderBudgetView() {
        const monthName = this.activeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const monthDisplay = document.getElementById('current-month');
        if (monthDisplay) {
            monthDisplay.textContent = monthName;
        }
        
        const isCurrentMonth = this.isCurrentMonth();
        const todayBtn = document.getElementById('return-today');
        if (todayBtn) {
            todayBtn.classList.toggle('hidden', isCurrentMonth);
        }
        
        const categories = await this.db.getAllCategories();
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
        
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => b.limit - a.limit);
        });
        
        let html = '';
        for (const type of ['Income', 'Expense', 'Saving', 'Transfer']) {
            if (grouped[type].length === 0) continue;
            
            html += `<div class="budget-group"><div class="group-header">${type}</div>`;
            
            for (const cat of grouped[type]) {
                const spent = await this.calculateCategorySpent(cat.id);
                const isTransfer = cat.type === 'Transfer';
                const percentage = cat.limit > 0 ? Math.min(100, (spent / cat.limit) * 100) : 0;
                
                html += `
                    <div class="budget-item ${isTransfer ? 'transfer' : ''}">
                        <div class="budget-header">
                            <span class="category-name">${cat.name}</span>
                            <span class="budget-amount">$${cat.limit.toFixed(2)}</span>
                        </div>
                        ${!isTransfer ? `
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
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
        
        const budgetList = document.getElementById('budget-list');
        if (budgetList) {
            budgetList.innerHTML = html || '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No categories yet</p>';
        }
    }

    async calculateCategorySpent(categoryId) {
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        const monthKey = this.getMonthKey(this.activeMonth);
        let total = 0;
        
        for (const t of transactions) {
            const date = await this.security.decrypt(t.encrypted_date);
            const transactionDate = new Date(date);
            const tKey = this.getMonthKey(transactionDate);
            
            if (tKey === monthKey) {
                const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
                total += Math.abs(amount);
            }
        }
        
        return total;
    }

    getMonthKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    isCurrentMonth() {
        const now = new Date();
        return this.getMonthKey(this.activeMonth) === this.getMonthKey(now);
    }

    async renderTransactionsList() {
        const transactions = await this.db.getAllTransactions();
        let html = '';
        
        if (transactions.length === 0) {
            html = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No transactions yet</p>';
        } else {
            for (const t of transactions) {
                const date = await this.security.decrypt(t.encrypted_date);
                const amount = await this.security.decrypt(t.encrypted_amount);
                const description = t.encrypted_description ? await this.security.decrypt(t.encrypted_description) : '';
                
                html += `
                    <div class="budget-item">
                        <div class="budget-header">
                            <span>${description || 'Transaction'}</span>
                            <span class="budget-amount">$${parseFloat(amount).toFixed(2)}</span>
                        </div>
                        <div class="review-meta">${date}</div>
                    </div>
                `;
            }
        }
        
        const transactionsList = document.getElementById('transactions-list');
        if (transactionsList) {
            transactionsList.innerHTML = html;
        }
    }

    async renderMappingsView() {
        const accountMappings = await this.db.getAllAccountMappings();
        const descriptionMappings = await this.db.getAllDescriptionMappings();
        
        let html = '<h3>Account Mappings</h3><div class="list-container">';
        
        for (const mapping of accountMappings) {
            const name = await this.security.decrypt(mapping.encrypted_name);
            html += `
                <div class="mapping-item">
                    <span class="mapping-key">${mapping.account_number}</span>
                    <span class="mapping-value">${name}</span>
                    <button class="btn-delete" onclick="app.deleteAccountMapping('${mapping.account_number}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
        }
        
        html += '</div><h3>Description Mappings</h3><div class="list-container">';
        
        for (const mapping of descriptionMappings) {
            const category = await this.security.decrypt(mapping.encrypted_category);
            const payee = await this.security.decrypt(mapping.encrypted_payee);
            html += `
                <div class="mapping-item">
                    <span class="mapping-key">${mapping.description}</span>
                    <span class="mapping-value">Cat: ${category}, Payee: ${payee}</span>
                    <button class="btn-delete" onclick="app.deleteDescriptionMapping('${mapping.description}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
        }
        
        html += '</div>';
        const mappingsList = document.getElementById('mappings-list');
        if (mappingsList) {
            mappingsList.innerHTML = html;
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async deleteAccountMapping(accountNumber) {
        await this.db.deleteAccountMapping(accountNumber);
        this.renderMappingsView();
    }

    async deleteDescriptionMapping(description) {
        await this.db.deleteDescriptionMapping(description);
        this.renderMappingsView();
    }

    async showCSVReview(results) {
        console.log('CSV Review:', results);
        alert(`CSV Import: ${results.total} transactions found, ${results.duplicates} duplicates detected`);
    }
}

// Initialize app
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new App();
    });
} else {
    app = new App();
}
