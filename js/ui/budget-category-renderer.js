/**
 * Budget Category Renderer - Handles budget list rendering and display
 * 
 * @module BudgetCategoryRenderer
 */

export class BudgetCategoryRenderer {
    constructor(security, db, monthManager) {
        this.security = security;
        this.db = db;
        this.monthManager = monthManager;
        
        // Callbacks
        this.onCategoryClick = null;
        this.onMonthlyBudgetClick = null;
    }

    /**
     * Render budget list for current month
     */
    async renderBudgetList() {
        const container = document.getElementById('budget-list');
        
        if (!container) {
            console.error('❌ Budget list container not found');
            return;
        }
        
        const categories = await this.db.getAllCategories();
        
        // Generate month header
        const monthHeader = this.monthManager.generateMonthHeader();
        
        // Render empty state if no categories
        if (categories.length === 0) {
            container.innerHTML = `
                ${monthHeader}
                <div class="budget-scroll-container">
                    <div class="budget-container">
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
                    </div>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Decrypt and group categories
        const monthlyBudgets = await this.db.getCategoryBudgetsForMonth(this.monthManager.currentMonth);
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
        
        // Group by type
        const grouped = {
            Income: [],
            Expense: [],
            Saving: [],
            Transfer: []
        };
        
        decryptedCategories.forEach(cat => {
            grouped[cat.type].push(cat);
        });
        
        // Sort by limit (descending)
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => b.limit - a.limit);
        });
        
        // Build HTML
        let html = monthHeader;
        html += '<div class="budget-scroll-container"><div class="budget-container">';
        
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
        
        // Render each group
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (grouped[type].length === 0) continue;
            
            html += `
                <div class="budget-group">
                    <h3 class="group-header ${typeColors[type]}">${type}</h3>
            `;
            
            for (const cat of grouped[type]) {
                const tracked = await this.monthManager.calculateCategoryTracked(cat.id, this.monthManager.currentMonth);
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
        
        html += '</div></div>'; // Close budget-container and budget-scroll-container
        
        container.innerHTML = html;
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Render FAB menu for budget actions
     */
    renderFABMenu() {
        const container = document.getElementById('budget-list');
        if (!container) return;
        
        const fabHTML = `
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
        
        container.insertAdjacentHTML('beforeend', fabHTML);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Attach FAB menu event listeners
     */
    attachFABListeners(onCopyMonthClick) {
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
        
        if (copyMonthBtn && onCopyMonthClick) {
            copyMonthBtn.addEventListener('click', () => {
                fabMenu.classList.add('hidden');
                onCopyMonthClick();
            });
        }
    }
}
