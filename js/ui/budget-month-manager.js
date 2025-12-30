/**
 * Budget Month Manager - Handles month navigation, state, and period-specific logic
 * 
 * @module BudgetMonthManager
 */

export class BudgetMonthManager {
    constructor(security, db) {
        this.security = security;
        this.db = db;
        
        // Initialize to current month
        const now = new Date();
        this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    /**
     * Change month by offset (e.g., -1 for previous, +1 for next)
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
     * Set month to current month
     */
    setCurrentMonth(onUpdateCallback) {
        const now = new Date();
        this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        if (onUpdateCallback) {
            onUpdateCallback();
        }
    }

    /**
     * Get formatted month name (e.g., "January 2025")
     */
    getMonthName(monthString) {
        const [year, month] = monthString.split('-');
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    /**
     * Check if given month is the current month
     */
    isCurrentMonth(monthString) {
        const now = new Date();
        const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return monthString === current;
    }

    /**
     * Generate month navigation header HTML
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
     * Attach month navigation event listeners
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
     * Calculate tracked amount for category in given month
     */
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

    /**
     * Update summary cards with budget totals for current month
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
