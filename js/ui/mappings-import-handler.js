/**
 * Mappings Import Handler - CSV import and review page logic
 * Handles CSV file processing, review page, filtering, and batch import
 * 
 * @module MappingsImportHandler
 */

export class MappingsImportHandler {
    constructor(security, db, csvEngine, modalManager) {
        this.security = security;
        this.db = db;
        this.csvEngine = csvEngine;
        this.modalManager = modalManager;
        
        // Import review state
        this.mappingsSearchQuery = '';
        this.mappingsFilterDuplicates = false;
        this.mappingsFilterUnmapped = false;
        this.mappingsFilterCategories = [];
        this.previousTab = null;
    }

    /**
     * Initialize CSV file input for import
     */
    initializeFileInput() {
        if (!document.getElementById('import-mappings-input')) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'import-mappings-input';
            fileInput.accept = '.csv';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
        }
        
        const fileInput = document.getElementById('import-mappings-input');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                await this.handleCSVFileSelection(e);
            });
        }
    }

    /**
     * Handle CSV file selection
     * @private
     */
    async handleCSVFileSelection(e) {
        if (e.target.files && e.target.files.length > 0) {
            try {
                const processedMappings = await this.csvEngine.processMappingsCSV(e.target.files);
                
                console.log('📥 Processed mappings from CSV:', processedMappings);
                
                if (processedMappings.length === 0) {
                    alert('No valid mappings found in CSV');
                    return;
                }
                
                const unmappedCategories = [...new Set(
                    processedMappings
                        .filter(m => !m.categoryId && m.categoryName)
                        .map(m => m.categoryName)
                )];
                
                // Filter out Transfer from unmapped (it's handled as a special type)
                const categoriesToResolve = unmappedCategories.filter(c => c.toLowerCase() !== 'transfer');
                
                console.log('🔍 Unmapped categories:', categoriesToResolve);
                
                if (categoriesToResolve.length > 0) {
                    const categoryResolutions = await this.modalManager.showCategoryResolutionModal(categoriesToResolve);
                    
                    if (!categoryResolutions) {
                        e.target.value = '';
                        return;
                    }
                    
                    for (const mapping of processedMappings) {
                        if (!mapping.categoryId && mapping.categoryName) {
                            const resolution = categoryResolutions[mapping.categoryName];
                            if (resolution) {
                                mapping.categoryId = resolution.categoryId;
                            }
                        }
                    }
                }
                
                await this.openMappingsReviewPage(processedMappings);
            } catch (error) {
                console.error('Mappings CSV import failed:', error);
                alert('Failed to import mappings CSV: ' + error.message);
            }
            e.target.value = '';
        }
    }

    /**
     * Open mappings review page
     */
    async openMappingsReviewPage(processedMappings) {
        const allCategories = await this.db.getAllCategories();
        
        this.mappingsSearchQuery = '';
        this.mappingsFilterDuplicates = false;
        this.mappingsFilterUnmapped = false;
        this.mappingsFilterCategories = [];
        
        const pageHTML = this.buildReviewPageHTML(processedMappings, allCategories);
        
        const mappingsPage = document.getElementById('csv-import-page');
        const mappingsContent = document.getElementById('csv-import-content');
        if (!mappingsPage || !mappingsContent) {
            console.error('CSV import page not found');
            return;
        }
        
        mappingsContent.innerHTML = pageHTML;
        
        this.previousTab = 'mappings';
        
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });
        mappingsPage.classList.remove('hidden');
        mappingsPage.classList.add('active');
        
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) bottomNav.style.display = 'none';
        
        document.querySelectorAll('.fab').forEach(fab => fab.classList.add('hidden'));
        
        this.attachReviewPageEvents(mappingsPage, processedMappings);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Build review page HTML
     * @private
     */
    buildReviewPageHTML(processedMappings, allCategories) {
        return `
            <div style="padding: 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <p style="margin: 0; font-weight: 600;"><strong id="mappings-total-count">${processedMappings.length}</strong> mappings (<span id="mappings-visible-count">${processedMappings.length}</span> visible)</p>
            </div>
            
            <div class="mappings-search-filter" style="padding: 1rem; background: var(--bg-primary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem;">
                    <div class="search-bar" style="flex: 1; margin: 0;">
                        <div class="search-input-wrapper">
                            <i data-lucide="search"></i>
                            <input type="text" id="mappings-search-input" placeholder="Search descriptions..." />
                        </div>
                    </div>
                    <button class="btn-icon" id="mappings-filter-toggle" title="Advanced Filters" style="flex-shrink: 0;">
                        <i data-lucide="sliders-horizontal"></i>
                    </button>
                </div>
                
                ${this.buildFilterPanelHTML()}
            </div>
            
            <div id="mappings-review-list" style="flex: 1; overflow-y: auto; padding: 1rem; padding-bottom: calc(80px + env(safe-area-inset-bottom));">
                ${this.buildMappingsReviewList(processedMappings, allCategories)}
            </div>
            
            <div style="position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 1rem; padding: 1rem; padding-bottom: calc(1rem + env(safe-area-inset-bottom)); background: var(--bg-secondary); border-top: 1px solid var(--border-color); z-index: 100;">
                <button class="btn btn-secondary" id="mappings-review-cancel" style="flex: 1;">Cancel</button>
                <button class="btn btn-primary" id="mappings-review-import" style="flex: 1;">Import Selected</button>
            </div>
        `;
    }

    /**
     * Build filter panel HTML
     * @private
     */
    buildFilterPanelHTML() {
        return `
            <div id="mappings-filter-panel" class="hidden" style="margin-top: 0.75rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                <h4 style="margin: 0 0 0.75rem 0; font-size: 0.875rem; font-weight: 600;">Quick Filters</h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                    <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                        <input type="checkbox" id="mappings-filter-duplicates">
                        Hide Duplicates
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                        <input type="checkbox" id="mappings-filter-unmapped">
                        Show Only Unmapped
                    </label>
                </div>
                
                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.875rem; font-weight: 600;">Filter by Category</h4>
                <div id="mappings-category-filters" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                </div>
                
                <button class="btn-secondary" id="mappings-skip-all" style="width: 100%;">
                    <i data-lucide="x-circle"></i>
                    Skip All Visible
                </button>
            </div>
        `;
    }

    /**
     * Build mappings review list HTML
     * @private
     */
    buildMappingsReviewList(processedMappings, allCategories) {
        let html = '<div class="csv-review-items">';
        
        for (let i = 0; i < processedMappings.length; i++) {
            const item = processedMappings[i];
            const isDuplicate = item.isDuplicate;
            const hasCategory = item.categoryId !== null;
            
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
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">${item.payee || ''}</span>
                        </div>
                        
                        <div class="csv-review-row" style="font-size: 0.875rem; color: var(${hasCategory ? '--success-color' : '--text-secondary'});">
                            <span>${hasCategory ? item.categoryName : 'Category not found'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Attach review page events
     * @private
     */
    attachReviewPageEvents(modal, processedMappings) {
        document.getElementById('csv-import-back').addEventListener('click', () => {
            this.closeMappingsImportPage();
        });
        
        document.getElementById('mappings-review-cancel').addEventListener('click', () => {
            this.closeMappingsImportPage();
        });
        
        document.getElementById('mappings-review-import').addEventListener('click', async () => {
            await this.handleMappingsImport(processedMappings);
            this.closeMappingsImportPage();
        });
        
        document.getElementById('mappings-search-input').addEventListener('input', (e) => {
            this.mappingsSearchQuery = e.target.value;
            this.applyMappingsFilters(modal, processedMappings);
        });
        
        document.getElementById('mappings-filter-toggle').addEventListener('click', () => {
            const panel = document.getElementById('mappings-filter-panel');
            if (panel) {
                panel.classList.toggle('hidden');
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        });
        
        this.populateCategoryFilters(processedMappings, modal);
        
        document.getElementById('mappings-filter-duplicates').addEventListener('change', (e) => {
            this.mappingsFilterDuplicates = e.target.checked;
            this.applyMappingsFilters(modal, processedMappings);
        });
        
        document.getElementById('mappings-filter-unmapped').addEventListener('change', (e) => {
            this.mappingsFilterUnmapped = e.target.checked;
            this.applyMappingsFilters(modal, processedMappings);
        });
        
        document.getElementById('mappings-skip-all').addEventListener('click', () => {
            modal.querySelectorAll('.csv-review-item').forEach((item) => {
                if (item.style.display !== 'none') {
                    const checkbox = item.querySelector('.csv-skip-checkbox');
                    if (checkbox && !checkbox.checked) {
                        checkbox.checked = true;
                        const index = parseInt(checkbox.dataset.index);
                        if (processedMappings[index]) {
                            processedMappings[index].skip = true;
                        }
                    }
                }
            });
        });
        
        modal.querySelectorAll('.csv-skip-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (processedMappings[index]) {
                    processedMappings[index].skip = e.target.checked;
                }
            });
        });
    }

    /**
     * Populate category filters
     * @private
     */
    populateCategoryFilters(processedMappings, modal) {
        const categoryFiltersContainer = document.getElementById('mappings-category-filters');
        if (categoryFiltersContainer) {
            const categorySet = new Set();
            processedMappings.forEach(m => {
                if (m.categoryName) categorySet.add(m.categoryName);
            });
            
            Array.from(categorySet).sort().forEach(catName => {
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '0.3rem';
                label.style.fontSize = '0.875rem';
                label.innerHTML = `
                    <input type="checkbox" class="mappings-category-filter" value="${catName}">
                    ${catName}
                `;
                categoryFiltersContainer.appendChild(label);
            });
            
            categoryFiltersContainer.querySelectorAll('.mappings-category-filter').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    this.mappingsFilterCategories = Array.from(
                        categoryFiltersContainer.querySelectorAll('.mappings-category-filter:checked')
                    ).map(cb => cb.value);
                    this.applyMappingsFilters(modal, processedMappings);
                });
            });
        }
    }

    /**
     * Apply mappings filters
     */
    applyMappingsFilters(modal, processedMappings) {
        const searchQuery = this.mappingsSearchQuery.toLowerCase();
        
        let visibleCount = 0;
        
        modal.querySelectorAll('.csv-review-item').forEach((item) => {
            const dataIndex = parseInt(item.getAttribute('data-item-index'));
            const data = processedMappings[dataIndex];
            if (!data) return;
            
            let shouldShow = true;
            
            if (searchQuery) {
                const description = (data.description || '').toLowerCase();
                const payee = (data.payee || '').toLowerCase();
                shouldShow = description.includes(searchQuery) || payee.includes(searchQuery);
            }
            
            if (shouldShow && this.mappingsFilterCategories && this.mappingsFilterCategories.length > 0) {
                shouldShow = this.mappingsFilterCategories.includes(data.categoryName);
            }
            
            if (shouldShow && this.mappingsFilterDuplicates) {
                shouldShow = !data.isDuplicate;
            }
            
            if (shouldShow && this.mappingsFilterUnmapped) {
                shouldShow = data.categoryId === null;
            }
            
            if (shouldShow) {
                item.style.display = '';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        const visibleCountEl = document.getElementById('mappings-visible-count');
        if (visibleCountEl) {
            visibleCountEl.textContent = visibleCount;
        }
    }

    /**
     * Handle mappings import
     */
    async handleMappingsImport(processedMappings) {
        const toImport = processedMappings.filter(item => !item.skip && !item.isDuplicate);
        
        if (toImport.length === 0) {
            alert('No mappings selected for import');
            return;
        }
        
        try {
            const imported = await this.csvEngine.importReviewedMappings(toImport);
            alert(`Successfully imported ${imported.length} mapping(s)`);
            
            // Callback to parent to re-render
            if (this.onMappingsImported) {
                await this.onMappingsImported();
            }
        } catch (error) {
            console.error('Mappings import failed:', error);
            alert('Import failed: ' + error.message);
        }
    }

    /**
     * Close mappings import page
     */
    closeMappingsImportPage() {
        const mappingsPage = document.getElementById('csv-import-page');
        const bottomNav = document.querySelector('.bottom-nav');
        
        if (mappingsPage) {
            mappingsPage.classList.remove('active');
            mappingsPage.classList.add('hidden');
        }
        
        if (bottomNav) bottomNav.style.display = '';
        
        // Callback to parent to show tab
        if (this.showTabCallback) {
            const returnTab = this.previousTab || 'mappings';
            this.showTabCallback(returnTab);
        }
    }
}
