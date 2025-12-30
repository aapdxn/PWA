/**
 * CSV Review UI - Coordinator for CSV import review functionality
 * Delegates to specialized modules for rendering, filtering, and import handling
 * 
 * @module CSVReviewUI
 */

import { CSVReviewRenderer } from './csv-review-renderer.js';
import { CSVReviewFilter } from './csv-review-filter.js';
import { CSVReviewImportHandler } from './csv-review-import-handler.js';

export class CSVReviewUI {
    constructor(security, db, accountMappingsUI) {
        this.security = security;
        this.db = db;
        
        // Initialize specialized modules
        this.renderer = new CSVReviewRenderer(security, db);
        this.filter = new CSVReviewFilter();
        this.importHandler = new CSVReviewImportHandler(security, db, accountMappingsUI);
        
        // Session mappings (description -> categoryId) set during current import
        this.importSessionMappings = {};
        
        // Track previous tab for return navigation
        this.previousTab = 'transactions';
        this.uiManager = null;
    }

    /**
     * Open CSV review page with processed data
     */
    async openCSVReviewPage(processedData, csvEngine, uiManager) {
        const allCategories = await this.db.getAllCategories();
        
        // Reset session mappings for new import
        this.importSessionMappings = {};
        
        // Save current tab for return navigation
        if (uiManager) {
            this.previousTab = uiManager.currentTab || 'transactions';
            this.uiManager = uiManager;
        }
        
        // Set import success callback
        this.importHandler.onImportSuccess = async () => {
            if (this.onImportSuccess) {
                await this.onImportSuccess();
            }
        };
        
        // Build page HTML
        const pageHTML = this.renderer.generateReviewPageHTML(processedData.length);
        
        // Insert into CSV import page
        const csvPage = document.getElementById('csv-import-page');
        const csvContent = document.getElementById('csv-import-content');
        if (!csvPage || !csvContent) {
            console.error('CSV import page not found');
            return;
        }
        
        csvContent.innerHTML = pageHTML;
        
        // Insert review list content
        const reviewList = document.getElementById('csv-review-list');
        if (reviewList) {
            reviewList.innerHTML = await this.renderer.buildCSVReviewList(
                processedData, 
                allCategories, 
                this.importSessionMappings
            );
        }
        
        // Show CSV import page, hide others
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });
        csvPage.classList.remove('hidden');
        csvPage.classList.add('active');
        
        // Hide bottom navigation and all FABs
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) bottomNav.style.display = 'none';
        
        document.querySelectorAll('.fab').forEach(fab => fab.classList.add('hidden'));
        
        // Attach all event listeners
        this.attachEventListeners(csvPage, processedData, csvEngine, allCategories);
        
        // Initialize custom selects
        this.filter.initializeCustomSelects();
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Attach all event listeners for CSV review page
     */
    attachEventListeners(modal, processedData, csvEngine, allCategories) {
        // Back button handler
        document.getElementById('csv-import-back')?.addEventListener('click', () => {
            this.closeCSVImportPage();
        });
        
        // Close/Cancel handlers
        document.getElementById('csv-review-cancel')?.addEventListener('click', () => {
            this.closeCSVImportPage();
        });
        
        // Import handler
        document.getElementById('csv-review-import')?.addEventListener('click', async () => {
            await this.importHandler.handleImport(processedData, csvEngine);
            this.closeCSVImportPage();
        });
        
        // Advanced search toggle
        document.getElementById('csv-advanced-search-toggle')?.addEventListener('click', () => {
            const panel = document.getElementById('csv-advanced-search-panel');
            panel?.classList.toggle('hidden');
        });
        
        // Section toggle handlers
        modal.querySelectorAll('.csv-section-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('collapsed');
                const content = toggle.nextElementSibling;
                if (content) content.classList.toggle('collapsed');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        });
        
        // Search handler
        document.getElementById('csv-search-input')?.addEventListener('input', (e) => {
            this.filter.csvSearchQuery = e.target.value;
            this.filter.applyFiltersAndSort(modal, processedData);
        });
        
        // Quick filter handlers
        document.getElementById('csv-filter-duplicates')?.addEventListener('change', (e) => {
            this.filter.csvFilterDuplicates = e.target.checked;
            this.filter.applyFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-unmapped')?.addEventListener('change', (e) => {
            this.filter.csvFilterUnmapped = e.target.checked;
            this.filter.applyFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-auto')?.addEventListener('change', (e) => {
            this.filter.csvFilterAuto = e.target.checked;
            this.filter.applyFiltersAndSort(modal, processedData);
        });
        
        // Advanced filter handlers
        ['csv-filter-amount-min', 'csv-filter-amount-max', 'csv-filter-date-start', 'csv-filter-date-end', 'csv-sort-field', 'csv-sort-order'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                this.filter.applyFiltersAndSort(modal, processedData);
            });
        });
        
        // Clear filters
        document.getElementById('csv-clear-filters')?.addEventListener('click', () => {
            this.filter.clearAllFilters();
            this.filter.applyFiltersAndSort(modal, processedData);
        });
        
        // Apply filters (close panel)
        document.getElementById('csv-apply-filters')?.addEventListener('click', () => {
            const panel = document.getElementById('csv-advanced-search-panel');
            panel?.classList.add('hidden');
        });
        
        // Skip All handler
        document.getElementById('csv-skip-all')?.addEventListener('click', () => {
            this.filter.skipAllVisibleItems(modal, processedData);
        });
        
        // Skip checkbox handlers
        modal.querySelectorAll('.csv-skip-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (processedData[index]) {
                    processedData[index].skip = e.target.checked;
                }
            });
        });
    }

    /**
     * Close CSV import page and return to previous tab
     */
    closeCSVImportPage() {
        const csvPage = document.getElementById('csv-import-page');
        const bottomNav = document.querySelector('.bottom-nav');
        
        // Hide CSV import page
        if (csvPage) {
            csvPage.classList.remove('active');
            csvPage.classList.add('hidden');
        }
        
        // Restore bottom navigation
        if (bottomNav) bottomNav.style.display = '';
        
        // Reset filter state
        this.filter.resetState();
        
        // Return to the tab that was active before opening CSV import
        const returnTab = this.previousTab || 'transactions';
        if (this.uiManager && this.uiManager.showTab) {
            this.uiManager.showTab(returnTab);
        }
    }
}
