/**
 * BudgetMonthManager - Month Navigation & State Management
 * 
 * RESPONSIBILITIES:
 * - Manage current month state for budget view
 * - Handle month navigation (previous, next, current)
 * - Generate month navigation UI components
 * - Calculate period-specific budget metrics
 * - Update summary cards with monthly totals
 * 
 * MONTH STATE PERSISTENCE:
 * - Stored as class property: this.currentMonth
 * - Format: 'YYYY-MM' (e.g., '2025-12')
 * - Initialized to current month on construction
 * - Persists across tab switches (class instance lifetime)
 * - NOT persisted to database or localStorage
 * 
 * NAVIGATION PATTERNS:
 * - Previous/Next: Move one month backward/forward
 * - Current: Jump back to today's month
 * - All navigation triggers callback to refresh UI
 * 
 * BUDGET CALCULATIONS:
 * - Tracked amount: Sum of absolute transaction amounts for category in month
 * - Monthly budget: Category budget override for specific month, or default if none
 * - Budgeted totals: Sum of limits by category type (Income, Expense, Saving)
 * - Remaining: Budgeted Income - Budgeted Outflow
 * 
 * CATEGORY TYPE LOGIC:
 * - Income: Adds to budgeted income (positive)
 * - Expense: Adds to budgeted outflow (negative)
 * - Saving: Adds to budgeted outflow (like expense)
 * - Transfer: Excluded from budget calculations
 * 
 * STATE REQUIREMENTS:
 * - Requires Unlocked state for all decrypt operations
 * 
 * @class BudgetMonthManager
 * @module UI/Budget
 * @layer 5 - UI Components
 */

export class BudgetMonthManager {
    /**
     * Initialize month manager with current month as default state
     * 
     * INITIAL STATE:
     * - Sets this.currentMonth to current month in 'YYYY-MM' format
     * - Month state persists as class property (not in database)
     * - State survives tab switches during app session
     * 
     * @param {SecurityManager} security - Web Crypto API wrapper for encryption/decryption
     * @param {DatabaseManager} db - Dexie database wrapper for CRUD operations
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
        
        // Initialize to current month
        const now = new Date();
        this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    /**
     * Navigate to different month by offset
     * 
     * Updates this.currentMonth class property and triggers UI refresh.
     * 
     * EXAMPLES:
     * - offset = -1: Previous month
     * - offset = +1: Next month
     * - offset = -12: Same month, previous year
     * 
     * @param {number} offset - Number of months to move (negative = past, positive = future)
     * @param {Function} [onUpdateCallback] - Callback to refresh UI after state change
     */
    changeMonth(offset, onUpdateCallback) {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        this.currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (onUpdateCallback) {
            onUpdateCallback();
        }
    }

    /**
     * Reset month to current month (today)
     * 
     * Used by "Current Month" button to jump back to present.
     * Updates this.currentMonth and triggers UI refresh.
     * 
     * @param {Function} [onUpdateCallback] - Callback to refresh UI after state change
     */
    setCurrentMonth(onUpdateCallback) {
        const now = new Date();
        this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        if (onUpdateCallback) {
            onUpdateCallback();
        }
    }

    /**
     * Format month string to human-readable name
     * 
     * Converts 'YYYY-MM' format to localized month name.
     * 
     * EXAMPLES:
     * - '2025-01' → 'January 2025'
     * - '2024-12' → 'December 2024'
     * 
     * @param {string} monthString - Month in 'YYYY-MM' format
     * @returns {string} Formatted month name (e.g., 'January 2025')
     */
    getMonthName(monthString) {
        const [year, month] = monthString.split('-');
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    /**
     * Check if given month matches today's month
     * 
     * Used to conditionally show/hide "Current Month" button.
     * 
     * @param {string} monthString - Month in 'YYYY-MM' format
     * @returns {boolean} True if month matches current month
     */
    isCurrentMonth(monthString) {
        const now = new Date();
        const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return monthString === current;
    }

    /**
     * Generate sticky month navigation header HTML
     * 
     * COMPONENTS:
     * - Previous Month button (chevron-left)
     * - Current month name (e.g., 'January 2025')
     * - Current Month button (only if not viewing current month)
     * - Next Month button (chevron-right)
     * 
     * STYLING:
     * - Sticky positioned at top (z-index: 10)
     * - Background matches secondary color
     * - Border-bottom for separation
     * 
     * @returns {string} HTML string for month navigation header
     */
    generateMonthHeader() {
        const monthName = this.getMonthName(this.currentMonth);
        const isCurrentMonth = this.isCurrentMonth(this.currentMonth);
        
        return `
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
    }

    /**
     * Attach event listeners to month navigation buttons
     * 
     * Finds and attaches click handlers to:
     * - #budget-prev-month: Previous month button
     * - #budget-next-month: Next month button
     * - #budget-current-month: Current month button (if visible)
     * 
     * All handlers trigger onUpdateCallback after state change.
     * 
     * @param {Function} onUpdateCallback - Callback to refresh UI after navigation
     */
    attachMonthNavigation(onUpdateCallback) {
        const prevBtn = document.getElementById('budget-prev-month');
        const nextBtn = document.getElementById('budget-next-month');
        const currentBtn = document.getElementById('budget-current-month');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.changeMonth(-1, onUpdateCallback));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.changeMonth(1, onUpdateCallback));
        }
        if (currentBtn) {
            currentBtn.addEventListener('click', () => this.setCurrentMonth(onUpdateCallback));
        }
    }

    /**
     * Calculate total tracked amount for category in specified month
     * 
     * CALCULATION:
     * 1. Fetch all transactions for categoryId
     * 2. Filter by month if provided (compares YYYY-MM portion of date)
     * 3. Decrypt and sum absolute values of transaction amounts
     * 4. Return total (always positive, regardless of category type)
     * 
     * AMOUNT HANDLING:
     * - Uses Math.abs() on each amount before summing
     * - Results in positive value for both Income and Expense categories
     * - Category type determines budget impact, not amount sign
     * 
     * @param {number} categoryId - Category to calculate tracked amount for
     * @param {string|null} [month=null] - Month in 'YYYY-MM' format, or null for all months
     * @returns {Promise<number>} Total tracked amount (always positive)
     */
    async calculateCategoryTracked(categoryId, month = null) {
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        let total = 0;
        
        // STATE GUARD: Decrypt requires unlocked state
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

    /**
     * Update summary cards with budget totals for current month
     * 
     * CALCULATIONS:
     * - Budgeted Income: Sum of all Income category limits (monthly or default)
     * - Budgeted Outflow: Sum of Expense + Saving category limits
     * - Remaining: Income - Outflow (red if negative)
     * 
     * CATEGORY TYPE HANDLING:
     * - Income: Adds to budgetedIncome
     * - Expense: Adds to budgetedOutflow
     * - Saving: Adds to budgetedOutflow (treated like expense)
     * - Transfer: Excluded from calculations
     * 
     * MONTHLY BUDGET PRIORITY:
     * - Uses monthly budget if set for current month
     * - Falls back to 0 if no monthly budget (not default limit)
     * - This differs from category display which may show defaults
     * 
     * DOM UPDATES:
     * - Updates .summary-card.income .summary-value
     * - Updates .summary-card.spent .summary-value
     * - Updates .summary-card.remaining .summary-value
     * - Adds .negative class if remaining < 0 (makes it red)
     * 
     * @returns {Promise<void>}
     */
    async updateSummaryCards() {
        console.log('📊 Updating summary cards for month:', this.currentMonth);
        
        const categories = await this.db.getAllCategories();
        const monthlyBudgets = await this.db.getCategoryBudgetsForMonth(this.currentMonth);
        
        let budgetedIncome = 0;
        let budgetedOutflow = 0;
        
        // Calculate budgeted totals by category type for the selected month
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
            } else if (categoryType === 'Expense' || categoryType === 'Saving') {
                budgetedOutflow += limit;
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
}
