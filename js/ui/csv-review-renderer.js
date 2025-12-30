/**
 * CSV Review Renderer - Handles HTML generation and list building for CSV import review
 * 
 * @module CSVReviewRenderer
 */

export class CSVReviewRenderer {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Generate main review page HTML structure
     */
    generateReviewPageHTML(processedDataLength) {
        return `
            <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                <div style="padding: 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                    <p style="margin: 0; font-weight: 600;"><strong id="csv-total-count">${processedDataLength}</strong> transactions (<span id="csv-visible-count">${processedDataLength}</span> visible)</p>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">Review transactions before importing - auto-categorized items shown based on existing mappings</p>
                </div>
                
                <!-- Search and Filter -->
                <div class="csv-search-filter" style="padding: 1rem; background: var(--bg-primary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                    <div class="search-bar" style="margin-bottom: 0.75rem;">
                        <div class="search-input-wrapper">
                            <i data-lucide="search"></i>
                            <input type="text" id="csv-search-input" placeholder="Search descriptions..." />
                        </div>
                        <button class="search-menu-btn" id="csv-advanced-search-toggle">
                            <i data-lucide="sliders-horizontal"></i>
                        </button>
                    </div>
                    
                    <!-- Advanced Search/Filter Panel -->
                    <div class="advanced-search-panel hidden" id="csv-advanced-search-panel" style="position: relative; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; margin-top: 0.75rem; max-height: 60vh; overflow: hidden; display: flex; flex-direction: column;">
                        <div class="advanced-scroll-container" style="flex: 1; overflow-y: auto; padding: 1rem;">
                            <div class="advanced-section">
                                <h4 class="section-toggle csv-section-toggle">
                                    <span>Quick Filters</span>
                                    <i data-lucide="chevron-down"></i>
                                </h4>
                                <div class="advanced-section-content">
                                    <div class="checkbox-group">
                                        <label><input type="checkbox" id="csv-filter-duplicates"> Hide Duplicates</label>
                                        <label><input type="checkbox" id="csv-filter-unmapped"> Show Only Unmapped</label>
                                        <label><input type="checkbox" id="csv-filter-auto"> Show Only Auto-Mapped</label>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="advanced-section">
                                <h4 class="section-toggle csv-section-toggle">
                                    <span>Sort By</span>
                                    <i data-lucide="chevron-down"></i>
                                </h4>
                                <div class="advanced-section-content">
                                    <select id="csv-sort-field">
                                        <option value="date">Date</option>
                                        <option value="amount">Amount</option>
                                        <option value="description">Description</option>
                                        <option value="account">Account</option>
                                    </select>
                                    <select id="csv-sort-order">
                                        <option value="desc">Descending</option>
                                        <option value="asc">Ascending</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="advanced-section">
                                <h4 class="section-toggle csv-section-toggle collapsed">
                                    <span>Filter by Amount</span>
                                    <i data-lucide="chevron-down"></i>
                                </h4>
                                <div class="advanced-section-content collapsed">
                                    <div class="filter-group">
                                        <div class="range-inputs">
                                            <input type="number" id="csv-filter-amount-min" placeholder="Min" step="0.01" />
                                            <span>to</span>
                                            <input type="number" id="csv-filter-amount-max" placeholder="Max" step="0.01" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="advanced-section">
                                <h4 class="section-toggle csv-section-toggle collapsed">
                                    <span>Filter by Date</span>
                                    <i data-lucide="chevron-down"></i>
                                </h4>
                                <div class="advanced-section-content collapsed">
                                    <div class="filter-group">
                                        <div class="range-inputs">
                                            <input type="date" id="csv-filter-date-start" />
                                            <span>to</span>
                                            <input type="date" id="csv-filter-date-end" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="advanced-actions" style="flex-shrink: 0; padding: 1rem; border-top: 1px solid var(--border-color); background: var(--bg-primary);">
                            <button class="btn-secondary" id="csv-clear-filters">Clear All</button>
                            <button class="btn-primary" id="csv-apply-filters">Apply</button>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.75rem;">
                        <button class="btn-secondary" id="csv-skip-all" style="width: auto; padding: 0.5rem 1rem; font-size: 0.875rem; margin-left: auto;">
                            <i data-lucide="x-circle"></i>
                            Skip All Visible
                        </button>
                    </div>
                </div>
                
                <div id="csv-review-list" style="flex: 1; overflow-y: auto; padding: 1rem; padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);">
                    <!-- List content will be inserted here -->
                </div>
                
                <div style="display: flex; gap: 1rem; padding: 1rem; padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); background: var(--bg-secondary); border-top: 1px solid var(--border-color); flex-shrink: 0; position: sticky; bottom: 0; z-index: 10;">
                    <button class="btn btn-secondary" id="csv-review-cancel" style="flex: 1;">Cancel</button>
                    <button class="btn btn-primary" id="csv-review-import" style="flex: 1;">Import Selected</button>
                </div>
            </div>
        `;
    }

    /**
     * Build CSV review list HTML from processed data
     */
    async buildCSVReviewList(processedData, allCategories, importSessionMappings = {}) {
        let html = '<div class="csv-review-items">';
        
        // Decrypt category names for display
        const categoryNames = {};
        for (const cat of allCategories) {
            categoryNames[cat.id] = await this.security.decrypt(cat.encrypted_name);
        }
        
        // Decrypt payee names for display
        const allPayees = await this.db.getAllPayees();
        const payeeNames = {};
        for (const payee of allPayees) {
            payeeNames[payee.id] = await this.security.decrypt(payee.encrypted_name);
        }
        
        for (let i = 0; i < processedData.length; i++) {
            const item = processedData[i];
            const isDuplicate = item.isDuplicate;
            const amountClass = item.amount >= 0 ? 'income' : 'expense';
            
            // Check session mappings first, then item's suggested category
            const sessionMapping = importSessionMappings[item.description];
            if (sessionMapping !== undefined && !item.isDuplicate && !item.skip) {
                item.suggestedCategoryId = sessionMapping;
            }
            
            const hasAutoMapping = item.suggestedCategoryId !== null;
            const hasPayeeMapping = item.suggestedPayeeId !== null;
            
            // Determine category status text
            let categoryStatus = '';
            if (hasAutoMapping) {
                const categoryLabel = item.suggestedCategoryId === 'TRANSFER' ? 'Transfer' : categoryNames[item.suggestedCategoryId];
                categoryStatus = `<span style="color: var(--success-color);">Auto (${categoryLabel})</span>`;
            } else {
                categoryStatus = 'Un-mapped';
            }
            
            // Payee status
            let payeeStatus = '';
            if (hasPayeeMapping) {
                const payeeLabel = payeeNames[item.suggestedPayeeId] || '';
                payeeStatus = `<span style="color: var(--success-color);">Auto (${payeeLabel})</span>`;
            } else {
                payeeStatus = 'Un-mapped';
            }
            
            html += `
                <div class="csv-review-item ${isDuplicate ? 'duplicate' : ''}" data-item-index="${i}">
                    <div class="csv-review-checkbox">
                        <input type="checkbox" class="csv-skip-checkbox" data-index="${i}" 
                               ${isDuplicate ? 'checked' : ''}>
                        <label style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${isDuplicate ? 'Duplicate' : 'Skip'}
                        </label>
                    </div>
                    
                    <div class="csv-review-details">
                        <div class="csv-review-row">
                            <strong>${item.description}</strong>
                            <span class="amount ${amountClass}">
                                ${item.amount >= 0 ? '+' : ''}${item.amount.toFixed(2)}
                            </span>
                        </div>
                        
                        <div class="csv-review-row" style="font-size: 0.875rem; color: var(--text-secondary);">
                            <span>${item.date}</span>
                            <span>${item.accountName}</span>
                        </div>
                        
                        ${!isDuplicate ? `
                        <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                            <div style="font-weight: 500; color: var(--text-secondary);">
                                Category: ${categoryStatus}
                            </div>
                            <div style="margin-top: 0.25rem; font-weight: 500; color: var(--text-secondary);">
                                Payee: ${payeeStatus}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
}
