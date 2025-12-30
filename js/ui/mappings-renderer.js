/**
 * Mappings Renderer - Display and filtering logic for mappings list
 * Handles rendering, search, and category filtering
 * 
 * @module MappingsRenderer
 */

export class MappingsRenderer {
    constructor(security, db) {
        this.security = security;
        this.db = db;
        this.allMappingsData = [];
    }

    /**
     * Render the mappings tab with search and filters
     */
    async renderMappingsTab() {
        console.log('🔗 Rendering mappings tab');
        const container = document.getElementById('mappings-list');
        if (!container) {
            console.error('Mappings container not found!');
            return;
        }
        
        const allMappings = await this.db.getAllMappingsDescriptions();
        
        const mappingsData = await Promise.all(allMappings.map(async (mapping) => {
            const categoryName = mapping.encrypted_category 
                ? await this.security.decrypt(mapping.encrypted_category) 
                : 'Uncategorized';
            const payeeName = mapping.encrypted_payee 
                ? await this.security.decrypt(mapping.encrypted_payee) 
                : '';
            return {
                description: mapping.description,
                categoryName: categoryName,
                payeeName: payeeName,
                raw: mapping
            };
        }));
        
        this.allMappingsData = mappingsData;
        
        if (mappingsData.length === 0) {
            this.renderEmptyState(container);
        } else {
            this.renderMappingsList(container, mappingsData);
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Render empty state
     * @private
     */
    renderEmptyState(container) {
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center;">
                <i data-lucide="link" style="width: 64px; height: 64px; color: var(--text-secondary); margin: 0 auto;"></i>
                <h3 style="margin-top: 20px;">No Mappings Yet</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">Create mappings to automatically categorize transactions</p>
            </div>
        `;
    }

    /**
     * Render mappings list with filters
     * @private
     */
    renderMappingsList(container, mappingsData) {
        const categories = [...new Set(mappingsData.map(m => m.categoryName))].sort();
        
        const categoryFilterOptions = categories.map(cat => 
            `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;">
                <input type="checkbox" class="mappings-category-filter" value="${cat}">
                <span>${cat}</span>
            </label>`
        ).join('');
        
        const headerHTML = `
            <div class="search-bar">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" id="mappings-search" placeholder="Search mappings..." />
                </div>
                <button class="search-menu-btn" id="mappings-filter-toggle">
                    <i data-lucide="menu"></i>
                </button>
            </div>
            <div style="position: sticky; top: 44px; background: var(--bg-secondary); z-index: 10; padding: 0 16px; border-bottom: 1px solid var(--border-color);">
                <div id="mappings-filter-panel" class="hidden" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong>Filter by Category</strong>
                        <button id="mappings-clear-filters" class="btn-text" style="font-size: 0.875rem;">Clear</button>
                    </div>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${categoryFilterOptions}
                    </div>
                </div>
                <div id="mappings-count" style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 8px;">
                    Showing ${mappingsData.length} mapping(s)
                </div>
            </div>
        `;
        
        let mappingsHTML = '';
        for (const mapping of mappingsData) {
            mappingsHTML += this.buildMappingItemHTML(mapping);
        }
        
        container.innerHTML = `
            ${headerHTML}
            <div class="mappings-scroll-container">
                ${mappingsHTML}
            </div>
        `;
        
        this.attachEventListeners();
    }

    /**
     * Build HTML for a single mapping item
     * @private
     */
    buildMappingItemHTML(mapping) {
        return `
            <div class="mapping-item" 
                 data-description-original="${mapping.description}" 
                 data-description="${mapping.description.toLowerCase()}" 
                 data-category="${mapping.categoryName.toLowerCase()}" 
                 data-payee="${mapping.payeeName.toLowerCase()}" 
                 style="padding: 12px; margin-bottom: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: background 0.2s;" 
                 onmouseover="this.style.background='var(--bg-tertiary)'" 
                 onmouseout="this.style.background='var(--bg-primary)'">
                <div style="font-weight: 600; color: var(--text-primary);">${mapping.description}</div>
                ${mapping.payeeName ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px;">Payee: ${mapping.payeeName}</div>` : ''}
                <div style="font-size: 0.875rem; color: var(--accent); margin-top: 4px;">→ ${mapping.categoryName}</div>
            </div>
        `;
    }

    /**
     * Attach event listeners for search and filters
     * @private
     */
    attachEventListeners() {
        const searchInput = document.getElementById('mappings-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterMappings());
        }
        
        const filterToggle = document.getElementById('mappings-filter-toggle');
        const filterPanel = document.getElementById('mappings-filter-panel');
        const mappingsScrollContainer = document.querySelector('.mappings-scroll-container');
        
        if (filterToggle && filterPanel) {
            filterToggle.addEventListener('click', () => {
                filterPanel.classList.toggle('hidden');
                // Disable scrolling on main mappings list when filter is open
                if (!filterPanel.classList.contains('hidden')) {
                    if (mappingsScrollContainer) {
                        mappingsScrollContainer.classList.add('scroll-disabled');
                    }
                } else {
                    if (mappingsScrollContainer) {
                        mappingsScrollContainer.classList.remove('scroll-disabled');
                    }
                }
            });
        }
        
        const categoryCheckboxes = document.querySelectorAll('.mappings-category-filter');
        categoryCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => this.filterMappings());
        });
        
        const clearFiltersBtn = document.getElementById('mappings-clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                searchInput.value = '';
                categoryCheckboxes.forEach(cb => cb.checked = false);
                this.filterMappings();
            });
        }
    }

    /**
     * Filter mappings based on search and category filters
     */
    filterMappings() {
        const searchTerm = document.getElementById('mappings-search')?.value.toLowerCase() || '';
        const selectedCategories = Array.from(document.querySelectorAll('.mappings-category-filter:checked'))
            .map(cb => cb.value.toLowerCase());
        
        const mappingItems = document.querySelectorAll('.mapping-item');
        let visibleCount = 0;
        
        mappingItems.forEach(item => {
            const description = item.dataset.description || '';
            const category = item.dataset.category || '';
            const payee = item.dataset.payee || '';
            
            const matchesSearch = searchTerm === '' || 
                description.includes(searchTerm) || 
                category.includes(searchTerm) || 
                payee.includes(searchTerm);
            
            const matchesCategory = selectedCategories.length === 0 || 
                selectedCategories.includes(category);
            
            if (matchesSearch && matchesCategory) {
                item.style.display = '';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        const countEl = document.getElementById('mappings-count');
        if (countEl) {
            countEl.textContent = `Showing ${visibleCount} mapping(s)`;
        }
    }
}
