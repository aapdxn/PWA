/**
 * BudgetUI - Budget Management Coordinator
 * 
 * RESPONSIBILITIES:
 * - Delegates to specialized modules for month navigation, category rendering, and form handling
 * - Coordinates communication between BudgetMonthManager, BudgetCategoryRenderer, and BudgetCategoryForm
 * - Provides unified API for budget tab operations
 * - Manages callbacks between modules for state synchronization
 * 
 * ARCHITECTURE:
 * - Uses composition pattern with three specialized modules
 * - BudgetMonthManager: Month state and navigation
 * - BudgetCategoryRenderer: Category list display
 * - BudgetCategoryForm: Category CRUD modals
 * 
 * STATE REQUIREMENTS:
 * - Requires Unlocked state for all decrypt operations
 * - Delegates state management to child modules
 * 
 * @class BudgetUI
 * @module UI/Budget
 * @layer 5 - UI Components
 */

import { BudgetMonthManager } from './budget-month-manager.js';
import { BudgetCategoryRenderer } from './budget-category-renderer.js';
import { BudgetCategoryForm } from './budget-category-form.js';

export class BudgetUI {
    /**
     * Initialize budget UI coordinator with dependency injection
     * 
     * @param {SecurityManager} security - Web Crypto API wrapper for encryption/decryption
     * @param {DatabaseManager} db - Dexie database wrapper for CRUD operations
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
        
        // Initialize specialized modules
        this.monthManager = new BudgetMonthManager(security, db);
        this.renderer = new BudgetCategoryRenderer(security, db, this.monthManager);
        this.form = new BudgetCategoryForm(security, db, this.monthManager);
        
        // Set callbacks for module communication
        this.form.onCategoryChanged = async () => await this.renderBudgetTab();
    }

    /**
     * Render complete budget tab including month navigation and category list
     * 
     * Orchestrates rendering by delegating to specialized modules:
     * 1. Calls onUpdateSummary to refresh summary cards
     * 2. Delegates category list rendering to BudgetCategoryRenderer
     * 3. Renders FAB menu for budget actions
     * 4. Attaches month navigation listeners via BudgetMonthManager
     * 
     * @param {Function} [onUpdateSummary] - Optional callback to refresh summary cards
     * @returns {Promise<void>}
     */
    async renderBudgetTab(onUpdateSummary) {
        console.log('💰 Rendering budget tab for month:', this.monthManager.currentMonth);
        
        // Update summary cards
        if (onUpdateSummary) {
            await onUpdateSummary();
        }
        
        // Render budget list
        await this.renderer.renderBudgetList();
        
        // Render FAB menu
        this.renderer.renderFABMenu();
        
        // Attach month navigation listeners
        this.monthManager.attachMonthNavigation(() => this.renderBudgetTab(onUpdateSummary));
        
        // Attach FAB listeners
        this.renderer.attachFABListeners(() => this.form.showCopyFromMonthModal());
    }

    /**
     * Update summary cards with budget totals for current month
     * 
     * Delegates to BudgetMonthManager.updateSummaryCards which calculates:
     * - Budgeted Income: Sum of all Income category limits
     * - Budgeted Outflow: Sum of Expense + Saving category limits
     * - Remaining: Income - Outflow (shows in red if negative)
     * 
     * @returns {Promise<void>}
     */
    async updateSummaryCards() {
        await this.monthManager.updateSummaryCards();
    }

    /**
     * Open category modal for creating or editing a category
     * 
     * If categoryId provided: Opens in edit mode (name/type read-only, budget editable)
     * If null: Opens in create mode (all fields editable)
     * 
     * @param {number|null} [categoryId=null] - Category ID to edit, or null to create new
     * @returns {Promise<void>}
     */
    async openCategoryModal(categoryId = null) {
        await this.form.openCategoryModal(categoryId);
    }

    /**
     * Save category changes (create new or update existing)
     * 
     * Delegates to BudgetCategoryForm.saveCategory which:
     * - For new categories: Creates category + sets monthly budget
     * - For existing: Updates monthly budget only (name/type immutable)
     * 
     * @param {Function} [onSuccess] - Callback after successful save (unused, kept for compatibility)
     * @returns {Promise<void>}
     */
    async saveCategory(onSuccess) {
        await this.form.saveCategory();
    }

    /**
     * Delete a budget category after validation
     * 
     * Prevents deletion if category has assigned transactions.
     * Requires user confirmation before deletion.
     * 
     * @param {number} categoryId - ID of category to delete
     * @returns {Promise<void>}
     */
    async deleteCategory(categoryId) {
        await this.form.deleteCategory(categoryId);
    }

    /**
     * Quick-edit monthly budget for a specific category
     * 
     * Shows prompt to set custom budget for current month.
     * If user clears value, removes monthly override and uses default.
     * 
     * @param {number} categoryId - Category to set budget for
     * @param {number} currentLimit - Current budget amount to display
     * @returns {Promise<void>}
     */
    async setMonthlyBudget(categoryId, currentLimit) {
        await this.form.setMonthlyBudget(categoryId, currentLimit);
    }
}
