/**
 * Budget UI - Coordinator for budget functionality
 * Delegates to specialized modules for month management, rendering, and forms
 * 
 * @module BudgetUI
 */

import { BudgetMonthManager } from './budget-month-manager.js';
import { BudgetCategoryRenderer } from './budget-category-renderer.js';
import { BudgetCategoryForm } from './budget-category-form.js';

export class BudgetUI {
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
     * Render budget tab (delegates to renderer and month manager)
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
     * Update summary cards (delegates to month manager)
     */
    async updateSummaryCards() {
        await this.monthManager.updateSummaryCards();
    }

    /**
     * Open category modal (delegates to form)
     */
    async openCategoryModal(categoryId = null) {
        await this.form.openCategoryModal(categoryId);
    }

    /**
     * Save category (delegates to form)
     */
    async saveCategory(onSuccess) {
        await this.form.saveCategory();
    }

    /**
     * Delete category (delegates to form)
     */
    async deleteCategory(categoryId) {
        await this.form.deleteCategory(categoryId);
    }

    /**
     * Set monthly budget (delegates to form)
     */
    async setMonthlyBudget(categoryId, currentLimit) {
        await this.form.setMonthlyBudget(categoryId, currentLimit);
    }
}
