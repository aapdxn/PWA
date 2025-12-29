// CSV Review UI - Handles CSV import review page, filtering, and import operations
import { CustomSelect } from './custom-select.js';

export class CSVReviewUI {
    constructor(security, db, accountMappingsUI) {
        this.security = security;
        this.db = db;
        this.accountMappingsUI = accountMappingsUI;
        
        // Custom select instances for CSV items
        this.csvCategorySelects = [];
        
        // Search/Filter state for CSV review
        this.csvSearchQuery = '';
        this.csvFilterDuplicates = false;
        this.csvFilterUnmapped = false;
        this.csvFilterAuto = false;
        
        // Session mappings (description -> categoryId) set during current import
        this.importSessionMappings = {};
        
        // Track previous tab for return navigation
        this.previousTab = 'transactions';
    }

    async openCSVReviewPage(processedData, csvEngine, uiManager) {
        const allCategories = await this.db.getAllCategories();
        
        // Reset session mappings for new import
        this.importSessionMappings = {};
        
        // Save current tab for return navigation
        if (uiManager) {
            this.previousTab = uiManager.currentTab || 'transactions';
            this.uiManager = uiManager;
        }
        
        // Build page HTML with fixed bottom buttons
        const pageHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                <div style="padding: 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                    <p style="margin: 0; font-weight: 600;"><strong id="csv-total-count">${processedData.length}</strong> transactions (<span id="csv-visible-count">${processedData.length}</span> visible)</p>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">Set mappings for each description - once set, they'll auto-apply to matching transactions in this import</p>
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
                        <button class="btn-secondary" id="csv-set-category-all" style="width: auto; padding: 0.5rem 1rem; font-size: 0.875rem; margin-left: auto;">
                            <i data-lucide="tag"></i>
                            Set Category for All Visible
                        </button>
                        <button class="btn-secondary" id="csv-skip-all" style="width: auto; padding: 0.5rem 1rem; font-size: 0.875rem;">
                            <i data-lucide="x-circle"></i>
                            Skip All Visible
                        </button>
                    </div>
                </div>
                
                <div id="csv-review-list" style="flex: 1; overflow-y: auto; padding: 1rem; padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);">
                    ${await this.buildCSVReviewList(processedData, allCategories)}
                </div>
                
                <div style="display: flex; gap: 1rem; padding: 1rem; padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); background: var(--bg-secondary); border-top: 1px solid var(--border-color); flex-shrink: 0; position: sticky; bottom: 0; z-index: 10;">
                    <button class="btn btn-secondary" id="csv-review-cancel" style="flex: 1;">Cancel</button>
                    <button class="btn btn-primary" id="csv-review-import" style="flex: 1;">Import Selected</button>
                </div>
            </div>
        `;
        
        // Insert into CSV import page
        const csvPage = document.getElementById('csv-import-page');
        const csvContent = document.getElementById('csv-import-content');
        if (!csvPage || !csvContent) {
            console.error('CSV import page not found');
            return;
        }
        
        csvContent.innerHTML = pageHTML;
        
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
        
        // Hide all FABs (there are multiple)
        document.querySelectorAll('.fab').forEach(fab => fab.classList.add('hidden'));
        
        // Attach all event listeners
        this.attachEventListeners(csvPage, processedData, csvEngine, allCategories);
        
        // Initialize custom selects for CSV items
        this.initializeCSVCustomSelects();
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

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
            await this.handleCSVImport(processedData, csvEngine);
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
            this.csvSearchQuery = e.target.value;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Quick filter handlers
        document.getElementById('csv-filter-duplicates')?.addEventListener('change', (e) => {
            this.csvFilterDuplicates = e.target.checked;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-unmapped')?.addEventListener('change', (e) => {
            this.csvFilterUnmapped = e.target.checked;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        document.getElementById('csv-filter-auto')?.addEventListener('change', (e) => {
            this.csvFilterAuto = e.target.checked;
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Advanced filter handlers
        ['csv-filter-amount-min', 'csv-filter-amount-max', 'csv-filter-date-start', 'csv-filter-date-end', 'csv-sort-field', 'csv-sort-order'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                this.applyCSVFiltersAndSort(modal, processedData);
            });
        });
        
        // Clear filters
        document.getElementById('csv-clear-filters')?.addEventListener('click', () => {
            this.csvSearchQuery = '';
            this.csvFilterDuplicates = false;
            this.csvFilterUnmapped = false;
            this.csvFilterAuto = false;
            
            document.getElementById('csv-search-input').value = '';
            document.getElementById('csv-filter-duplicates').checked = false;
            document.getElementById('csv-filter-unmapped').checked = false;
            document.getElementById('csv-filter-auto').checked = false;
            document.getElementById('csv-filter-amount-min').value = '';
            document.getElementById('csv-filter-amount-max').value = '';
            document.getElementById('csv-filter-date-start').value = '';
            document.getElementById('csv-filter-date-end').value = '';
            document.getElementById('csv-sort-field').value = 'date';
            document.getElementById('csv-sort-order').value = 'desc';
            
            this.applyCSVFiltersAndSort(modal, processedData);
        });
        
        // Apply filters (close panel)
        document.getElementById('csv-apply-filters')?.addEventListener('click', () => {
            const panel = document.getElementById('csv-advanced-search-panel');
            panel?.classList.add('hidden');
        });
        
        // Skip All handler
        document.getElementById('csv-skip-all')?.addEventListener('click', () => {
            this.skipAllVisibleCSVItems(modal, processedData);
        });
        
        // Set Category for All handler
        document.getElementById('csv-set-category-all')?.addEventListener('click', async () => {
            await this.setCategoryForAllVisible(modal, processedData, allCategories);
        });
        
        // Attach review list-specific listeners
        this.attachCSVReviewListeners(modal, processedData, csvEngine, allCategories);
    }

    attachCSVReviewListeners(modal, processedData, csvEngine, allCategories) {
        // Mapping type change handlers (Auto/Manual toggle)
        modal.querySelectorAll('.csv-mapping-type').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const item = processedData[index];
                const itemElement = modal.querySelector(`[data-item-index="${index}"]`);
                const categorySelect = itemElement.querySelector('.csv-category-select');
                const saveButton = itemElement.querySelector('.csv-save-mapping');
                
                if (e.target.value === 'auto') {
                    const hasMapping = this.importSessionMappings[item.description] !== undefined;
                    if (hasMapping) {
                        categorySelect.disabled = true;
                        if (saveButton) saveButton.classList.add('hidden');
                    } else {
                        categorySelect.disabled = false;
                        if (saveButton) saveButton.classList.remove('hidden');
                    }
                } else {
                    categorySelect.disabled = false;
                    if (saveButton) saveButton.classList.add('hidden');
                }
            });
        });
        
        // Save mapping button handlers
        modal.querySelectorAll('.csv-save-mapping').forEach(button => {
            button.addEventListener('click', async (e) => {
                const index = parseInt(e.target.closest('[data-index]').dataset.index);
                const item = processedData[index];
                const itemElement = e.target.closest('.csv-review-item');
                const categorySelect = itemElement?.querySelector('.csv-category-select');
                
                if (!categorySelect) {
                    console.error('Category select not found');
                    return;
                }
                
                const categoryId = parseInt(categorySelect.value);
                if (!categoryId) {
                    alert('Please select a category first');
                    return;
                }
                
                // Save mapping for this description
                this.importSessionMappings[item.description] = categoryId;
                
                // Rebuild the entire list to apply the new mapping
                const reviewList = document.getElementById('csv-review-list');
                reviewList.innerHTML = await this.buildCSVReviewList(processedData, allCategories);
                
                // Re-apply current filters and sorting
                this.applyCSVFiltersAndSort(modal, processedData);
                
                // Re-attach all event listeners
                this.attachCSVReviewListeners(modal, processedData, csvEngine, allCategories);
                
                // Re-initialize Lucide icons
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        });
        
        // Category change handlers
        modal.querySelectorAll('.csv-category-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const categoryId = parseInt(e.target.value);
                const item = processedData[index];
                if (item) item.categoryId = categoryId;
            });
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

    async buildCSVReviewList(processedData, allCategories) {
        let html = '<div class="csv-review-items">';
        
        // Decrypt category names for display
        const categoryNames = {};
        for (const cat of allCategories) {
            categoryNames[cat.id] = await this.security.decrypt(cat.encrypted_name);
        }
        
        for (let i = 0; i < processedData.length; i++) {
            const item = processedData[i];
            const isDuplicate = item.isDuplicate;
            const amountClass = item.amount >= 0 ? 'income' : 'expense';
            
            // Check session mappings first, then item's suggested category
            const sessionMapping = this.importSessionMappings[item.description];
            if (sessionMapping !== undefined && !item.isDuplicate && !item.skip) {
                item.suggestedCategoryId = sessionMapping;
            }
            
            const hasAutoMapping = item.suggestedCategoryId !== null;
            
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
                        <div class="csv-mapping-controls" style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                                    <input type="radio" name="mapping-type-${i}" value="auto" class="csv-mapping-type" data-index="${i}" ${hasAutoMapping ? 'checked' : ''}>
                                    Auto ${hasAutoMapping ? `<span style="color: var(--success-color); font-weight: 600;">(${item.suggestedCategoryId === 'TRANSFER' ? 'Transfer' : categoryNames[item.suggestedCategoryId]})</span>` : ''}
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                                    <input type="radio" name="mapping-type-${i}" value="manual" class="csv-mapping-type" data-index="${i}" ${!hasAutoMapping ? 'checked' : ''}>
                                    Manual
                                </label>
                            </div>
                            
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <select class="csv-category-select" data-index="${i}" ${hasAutoMapping ? 'disabled' : ''} style="flex: 1;">
                                    <option value="">Select Category...</option>
                                    ${allCategories.map(cat => {
                                        const selected = cat.id === item.suggestedCategoryId ? 'selected' : '';
                                        return `<option value="${cat.id}" ${selected}>${categoryNames[cat.id]}</option>`;
                                    }).join('')}
                                    <option value="TRANSFER" ${item.suggestedCategoryId === 'TRANSFER' ? 'selected' : ''}>Transfer</option>
                                </select>
                                <button class="btn-primary csv-save-mapping hidden" data-index="${i}" style="padding: 0.5rem; font-size: 1rem; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Save as Auto Mapping">
                                    <i data-lucide="check"></i>
                                </button>
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

    applyCSVFiltersAndSort(modal, processedData) {
        const searchQuery = this.csvSearchQuery.toLowerCase();
        const amountMin = parseFloat(document.getElementById('csv-filter-amount-min')?.value) || null;
        const amountMax = parseFloat(document.getElementById('csv-filter-amount-max')?.value) || null;
        const dateStart = document.getElementById('csv-filter-date-start')?.value || null;
        const dateEnd = document.getElementById('csv-filter-date-end')?.value || null;
        const sortField = document.getElementById('csv-sort-field')?.value || 'date';
        const sortOrder = document.getElementById('csv-sort-order')?.value || 'desc';
        
        // Create array of items with their indices
        const items = [];
        modal.querySelectorAll('.csv-review-item').forEach((item) => {
            const dataIndex = parseInt(item.getAttribute('data-item-index'));
            const data = processedData[dataIndex];
            if (!data) return;
            
            let shouldShow = true;
            
            // Apply search filter
            if (searchQuery) {
                const description = (data.description || '').toLowerCase();
                const account = (data.accountName || '').toLowerCase();
                shouldShow = description.includes(searchQuery) || account.includes(searchQuery);
            }
            
            // Apply quick filters
            if (shouldShow && this.csvFilterDuplicates) {
                shouldShow = !data.isDuplicate;
            }
            
            if (shouldShow && this.csvFilterUnmapped) {
                shouldShow = data.suggestedCategoryId === null;
            }
            
            if (shouldShow && this.csvFilterAuto) {
                shouldShow = data.suggestedCategoryId !== null;
            }
            
            // Apply amount filter
            if (shouldShow && amountMin !== null) {
                shouldShow = Math.abs(data.amount) >= amountMin;
            }
            
            if (shouldShow && amountMax !== null) {
                shouldShow = Math.abs(data.amount) <= amountMax;
            }
            
            // Apply date filter
            if (shouldShow && dateStart) {
                shouldShow = new Date(data.date) >= new Date(dateStart);
            }
            
            if (shouldShow && dateEnd) {
                shouldShow = new Date(data.date) <= new Date(dateEnd);
            }
            
            items.push({ element: item, data, shouldShow, index: dataIndex });
        });
        
        // Sort visible items
        const visibleItems = items.filter(item => item.shouldShow);
        visibleItems.sort((a, b) => {
            let aVal, bVal;
            
            switch (sortField) {
                case 'date':
                    aVal = new Date(a.data.date);
                    bVal = new Date(b.data.date);
                    break;
                case 'amount':
                    aVal = Math.abs(a.data.amount);
                    bVal = Math.abs(b.data.amount);
                    break;
                case 'description':
                    aVal = a.data.description.toLowerCase();
                    bVal = b.data.description.toLowerCase();
                    break;
                case 'account':
                    aVal = a.data.accountName.toLowerCase();
                    bVal = b.data.accountName.toLowerCase();
                    break;
                default:
                    return 0;
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        // Apply visibility and reorder
        const container = modal.querySelector('.csv-review-items');
        if (container) {
            // Hide all first
            items.forEach(item => {
                item.element.style.display = 'none';
            });
            
            // Show and reorder visible items
            visibleItems.forEach(item => {
                item.element.style.display = '';
                container.appendChild(item.element);
            });
            
            // Initialize custom selects for visible items
            this.initializeCSVCustomSelects();
        }
        
        // Update count
        const visibleCount = document.getElementById('csv-visible-count');
        if (visibleCount) {
            visibleCount.textContent = visibleItems.length;
        }
    }

    initializeCSVCustomSelects() {
        // Destroy existing custom selects
        this.csvCategorySelects.forEach(cs => {
            try {
                cs.destroy();
            } catch (e) {
                // Ignore if already destroyed
            }
        });
        this.csvCategorySelects = [];
        
        // Initialize custom selects for all category dropdowns
        document.querySelectorAll('.csv-category-select').forEach(select => {
            if (select.offsetParent !== null) { // Only initialize if visible
                const customSelect = new CustomSelect(select);
                this.csvCategorySelects.push(customSelect);
            }
        });
    }

    skipAllVisibleCSVItems(modal, processedData) {
        let skippedCount = 0;
        
        modal.querySelectorAll('.csv-review-item').forEach((item, index) => {
            if (item.style.display !== 'none') {
                const checkbox = item.querySelector('.csv-skip-checkbox');
                if (checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    processedData[index].skip = true;
                    skippedCount++;
                }
            }
        });
        
        if (skippedCount > 0) {
            const skipBtn = document.getElementById('csv-skip-all');
            const originalText = skipBtn.innerHTML;
            skipBtn.innerHTML = `<i data-lucide="check"></i> Skipped ${skippedCount}`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                skipBtn.innerHTML = originalText;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 1500);
        }
    }

    async setCategoryForAllVisible(modal, processedData, allCategories) {
        // Get visible, non-skipped items
        const visibleItems = modal.querySelectorAll('.csv-review-item:not([style*="display: none"])');
        const eligibleItems = [];
        
        visibleItems.forEach(item => {
            const index = parseInt(item.dataset.itemIndex);
            const dataItem = processedData[index];
            if (!dataItem.isDuplicate && !dataItem.skip) {
                eligibleItems.push({ index, item: dataItem, element: item });
            }
        });
        
        if (eligibleItems.length === 0) {
            alert('No eligible transactions found. All visible transactions are either duplicates or skipped.');
            return;
        }
        
        // Show category selection modal
        const selectedCategoryId = await this.showBulkCategoryModal(allCategories, eligibleItems.length);
        
        if (selectedCategoryId === null) {
            return; // User cancelled
        }
        
        // Apply category to all eligible items
        let updatedCount = 0;
        eligibleItems.forEach(({ index, item, element }) => {
            // Set the category in the data
            item.suggestedCategoryId = selectedCategoryId;
            item.categoryId = selectedCategoryId;
            
            // Update UI to reflect Auto mode with the selected category
            const autoRadio = element.querySelector('input[value="auto"]');
            const categorySelect = element.querySelector('.csv-category-select');
            const saveButton = element.querySelector('.csv-save-mapping');
            
            if (autoRadio) {
                autoRadio.checked = true;
                if (categorySelect) {
                    categorySelect.value = selectedCategoryId;
                    categorySelect.disabled = true;
                }
                if (saveButton) {
                    saveButton.classList.add('hidden');
                }
            }
            
            // Update session mapping for this description
            this.importSessionMappings[item.description] = selectedCategoryId;
            updatedCount++;
        });
        
        // Rebuild the review list to show updated Auto labels
        const reviewList = modal.querySelector('#csv-review-list');
        if (reviewList) {
            reviewList.innerHTML = await this.buildCSVReviewList(processedData, allCategories);
            this.attachCSVReviewListeners(modal, processedData, null, allCategories);
            this.initializeCSVCustomSelects();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        
        // Re-apply filters to maintain current view
        this.applyCSVFiltersAndSort(modal, processedData);
        
        // Show success feedback
        const setCategoryBtn = document.getElementById('csv-set-category-all');
        if (setCategoryBtn) {
            const originalText = setCategoryBtn.innerHTML;
            setCategoryBtn.innerHTML = `<i data-lucide="check"></i> Updated ${updatedCount}`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                setCategoryBtn.innerHTML = originalText;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 1500);
        }
    }

    async showBulkCategoryModal(allCategories, transactionCount) {
        return new Promise(async (resolve) => {
            // Decrypt category names
            const categoryNames = {};
            for (const cat of allCategories) {
                categoryNames[cat.id] = await this.security.decrypt(cat.encrypted_name);
            }
            
            const modalHTML = `
                <div class="modal-overlay" id="bulk-category-modal">
                    <div class="modal-content" style="max-width: 500px;">
                        <div class="modal-header">
                            <h2>Set Category for All Visible</h2>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                                Select a category to apply to <strong>${transactionCount}</strong> visible transaction${transactionCount !== 1 ? 's' : ''}.
                            </p>
                            <select id="bulk-category-select" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 1rem;">
                                <option value="">Select Category...</option>
                                ${allCategories.map(cat => 
                                    `<option value="${cat.id}">${categoryNames[cat.id]}</option>`
                                ).join('')}
                                <option value="TRANSFER">Transfer</option>
                            </select>
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-secondary" id="bulk-category-cancel">Cancel</button>
                            <button class="btn btn-primary" id="bulk-category-confirm">Apply</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modalElement = document.getElementById('bulk-category-modal');
            const selectElement = document.getElementById('bulk-category-select');
            
            // Cancel handler
            document.getElementById('bulk-category-cancel')?.addEventListener('click', () => {
                modalElement.remove();
                resolve(null);
            });
            
            // Confirm handler
            document.getElementById('bulk-category-confirm')?.addEventListener('click', () => {
                const selectedValue = selectElement.value;
                if (!selectedValue) {
                    alert('Please select a category');
                    return;
                }
                modalElement.remove();
                resolve(selectedValue);
            });
            
            // Close on overlay click
            modalElement.addEventListener('click', (e) => {
                if (e.target === modalElement) {
                    modalElement.remove();
                    resolve(null);
                }
            });
        });
    }

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
        
        // Reset CSV filters
        this.csvSearchQuery = '';
        this.csvFilterDuplicates = false;
        this.csvFilterUnmapped = false;
        this.csvFilterAuto = false;
        
        // Return to the tab that was active before opening CSV import
        const returnTab = this.previousTab || 'transactions';
        if (this.uiManager && this.uiManager.showTab) {
            this.uiManager.showTab(returnTab);
        }
    }

    async handleCSVImport(processedData, csvEngine) {
        // Filter out skipped and duplicate items
        const toImport = processedData.filter(item => !item.skip && !item.isDuplicate);
        
        if (toImport.length === 0) {
            alert('No transactions selected for import');
            return;
        }
        
        // Prepare items for import - ensure categoryId is set for auto-mapped items
        const preparedItems = toImport.map(item => {
            // If categoryId is not set but suggestedCategoryId is, use it (Auto mode)
            if (!item.categoryId && item.suggestedCategoryId) {
                return { ...item, categoryId: item.suggestedCategoryId };
            }
            return item;
        });
        
        try {
            // Auto-populate account mappings for all unique accounts
            const uniqueAccounts = new Set();
            for (const item of preparedItems) {
                if (item.accountNumber) {
                    uniqueAccounts.add(item.accountNumber);
                }
            }
            for (const accountNumber of uniqueAccounts) {
                await this.accountMappingsUI.ensureAccountMappingExists(accountNumber);
            }
            
            const imported = await csvEngine.importReviewedTransactions(preparedItems);
            
            // Count uncategorized transactions (no categoryId and no encrypted_linkedTransactionId field)
            const uncategorized = imported.filter(t => !t.categoryId && t.encrypted_linkedTransactionId === undefined);
            
            let message = `Successfully imported ${imported.length} transaction(s)`;
            if (uncategorized.length > 0) {
                message += `\n\n${uncategorized.length} transaction(s) have no category assigned.`;
            }
            alert(message);
            
            // Trigger transaction refresh if available
            if (this.onImportSuccess) {
                await this.onImportSuccess();
            }
        } catch (error) {
            console.error('CSV import failed:', error);
            alert('Import failed: ' + error.message);
        }
    }
}
