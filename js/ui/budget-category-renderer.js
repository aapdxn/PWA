/**
 * BudgetCategoryRenderer - Category List Display & Rendering
 * 
 * RESPONSIBILITIES:
 * - Render budget category list with progress tracking
 * - Group categories by type (Income, Expense, Saving)
 * - Calculate and display budget progress for current month
 * - Render FAB menu for budget actions
 * - Handle empty states
 * 
 * CATEGORY TYPE GROUPING:
 * - Income: Green header/cards, shows income budgets
 * - Expense: Red header/cards, shows expense budgets
 * - Saving: Blue header/cards, shows saving goals
 * - Transfer: Hidden from budget view (no tracking)
 * 
 * PROGRESS CALCULATIONS:
 * - Tracked: Sum of absolute transaction amounts for category in current month
 * - Remaining: Budget limit - Tracked amount
 * - Percentage: (Tracked / Limit) * 100, capped at 100% for display
 * - Over-budget: Red progress bar when tracked > limit
 * 
 * AMOUNT SIGN CONVENTIONS:
 * - All amounts displayed as positive values
 * - Tracked amounts use Math.abs() for display
 * - Progress calculations use absolute values
 * - Category type determines income vs expense classification
 * 
 * MONTHLY BUDGET INDICATORS:
 * - Underlined amount = Has monthly override for current month
 * - Regular amount = Using default category limit
 * - Click amount to quick-edit monthly budget
 * 
 * STATE REQUIREMENTS:
 * - Requires Unlocked state for all decrypt operations
 * 
 * @class BudgetCategoryRenderer
 * @module UI/Budget
 * @layer 5 - UI Components
 */

export class BudgetCategoryRenderer {
    /**
     * Initialize category renderer with dependency injection
     * 
     * @param {SecurityManager} security - Web Crypto API wrapper for encryption/decryption
     * @param {DatabaseManager} db - Dexie database wrapper for CRUD operations
     * @param {BudgetMonthManager} monthManager - Month navigation manager for current month context
     */
    constructor(security, db, monthManager) {
        this.security = security;
        this.db = db;
        this.monthManager = monthManager;
        
        // Callbacks
        this.onCategoryClick = null;
        this.onMonthlyBudgetClick = null;
    }

    /**
     * Render complete budget category list for current month
     * 
     * RENDERING PROCESS:
     * 1. Fetch all categories from database
     * 2. Get monthly budgets for current month
     * 3. Decrypt category data and budget limits
     * 4. Group categories by type (Income, Expense, Saving)
     * 5. Calculate tracked amounts and progress for each category
     * 6. Render grouped sections with progress bars
     * 7. Show empty state if no categories exist
     * 
     * DISPLAY SECTIONS:
     * - Month navigation header (sticky)
     * - Income categories (green cards)
     * - Expense categories (red cards)
     * - Saving categories (blue cards)
     * - Transfer categories excluded from display
     * 
     * MONTHLY BUDGET LOGIC:
     * - Uses monthly budget if set for current month
     * - Falls back to 0 if no monthly budget exists
     * - Monthly overrides indicated with underline
     * 
     * @returns {Promise<void>}
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
                // STATE GUARD: Decrypt requires unlocked state
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
     * Render floating action button (FAB) menu for budget actions
     * 
     * MENU ITEMS:
     * - Add Category: Create new budget category
     * - Copy from Month: Bulk copy budgets from another month
     * 
     * FAB BEHAVIOR:
     * - Click FAB to toggle menu visibility
     * - Click outside to close menu
     * - Menu items trigger corresponding actions
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
     * Attach event listeners to FAB menu
     * 
     * LISTENERS:
     * - FAB button: Toggle menu visibility
     * - Document click: Close menu when clicking outside
     * - Copy Month button: Trigger copy from month modal
     * 
     * @param {Function} onCopyMonthClick - Callback when "Copy from Month" is clicked
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
