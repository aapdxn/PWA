// MappingsUI - Handles mappings tab, modals, CSV import, and filtering
import { CustomSelect } from './custom-select.js';

export class MappingsUI {
    constructor(security, db, csvEngine, modalManager) {
        this.security = security;
        this.db = db;
        this.csvEngine = csvEngine;
        this.modalManager = modalManager;
        
        // Custom select instance
        this.mappingCategorySelect = null;
        
        // State
        this.allMappingsData = [];
        this.previousTab = null;
        this.mappingsSearchQuery = '';
        this.mappingsFilterDuplicates = false;
        this.mappingsFilterUnmapped = false;
        this.mappingsFilterCategories = [];
    }

    async renderMappingsTab() {
        console.log('🔗 Rendering mappings tab');
        const container = document.getElementById('mappings-list');
        if (!container) {
            console.error('Mappings container not found!');
            return;
        }
        
        const allMappings = await this.db.getAllMappingsDescriptions();
        
        const mappingsData = await Promise.all(allMappings.map(async (mapping) => {
            const categoryName = mapping.encrypted_category ? await this.security.decrypt(mapping.encrypted_category) : 'Uncategorized';
            const payeeName = mapping.encrypted_payee ? await this.security.decrypt(mapping.encrypted_payee) : '';
            return {
                description: mapping.description,
                categoryName: categoryName,
                payeeName: payeeName,
                raw: mapping
            };
        }));
        
        this.allMappingsData = mappingsData;
        
        if (mappingsData.length === 0) {
            container.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <i data-lucide="link" style="width: 64px; height: 64px; color: var(--text-secondary); margin: 0 auto;"></i>
                    <h3 style="margin-top: 20px;">No Mappings Yet</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">Create mappings to automatically categorize transactions</p>
                </div>
            `;
        } else {
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
                mappingsHTML += `
                    <div class="mapping-item" data-description-original="${mapping.description}" data-description="${mapping.description.toLowerCase()}" data-category="${mapping.categoryName.toLowerCase()}" data-payee="${mapping.payeeName.toLowerCase()}" style="padding: 12px; margin-bottom: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='var(--bg-primary)'">
                        <div style="font-weight: 600; color: var(--text-primary);">${mapping.description}</div>
                        ${mapping.payeeName ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px;">Payee: ${mapping.payeeName}</div>` : ''}
                        <div style="font-size: 0.875rem; color: var(--accent); margin-top: 4px;">→ ${mapping.categoryName}</div>
                    </div>
                `;
            }
            
            container.innerHTML = `
                ${headerHTML}
                <div class="mappings-scroll-container">
                    ${mappingsHTML}
                </div>
            `;
            
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
            });
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    toggleMappingFabMenu() {
        const menu = document.getElementById('fab-mapping-menu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    }

    async openMappingForEdit(description) {
        // Find the mapping by description
        const allMappings = await this.db.getAllMappingsDescriptions();
        const mapping = allMappings.find(m => m.description === description);
        
        if (!mapping) {
            console.error('Mapping not found:', description);
            return;
        }
        
        // Decrypt the mapping data
        const categoryName = mapping.encrypted_category ? await this.security.decrypt(mapping.encrypted_category) : '';
        const payeeName = mapping.encrypted_payee ? await this.security.decrypt(mapping.encrypted_payee) : '';
        
        // Find the category ID from the category name
        const allCategories = await this.db.getAllCategories();
        let selectedCategoryId = null;
        
        for (const cat of allCategories) {
            const name = await this.security.decrypt(cat.encrypted_name);
            if (name === categoryName) {
                selectedCategoryId = cat.id;
                break;
            }
        }
        
        // Open the modal with pre-filled data
        await this.showManualMappingModal({
            description: mapping.description,
            encrypted_payee: mapping.encrypted_payee,
            categoryId: selectedCategoryId
        });
        
        // Pre-select the category in the dropdown
        if (selectedCategoryId) {
            const categorySelect = document.getElementById('mapping-category');
            if (categorySelect) {
                categorySelect.value = selectedCategoryId;
            }
        }
    }

    async showManualMappingModal(mapping = null) {
        const categories = await this.db.getAllCategories();
        const isEdit = !!mapping;
        
        const categoryOptions = await Promise.all(categories.map(async (cat) => {
            const name = await this.security.decrypt(cat.encrypted_name);
            return `<option value="${cat.id}">${name} (${cat.type})</option>`;
        }));
        
        const modalHTML = `
            <div class="modal-overlay" id="manual-mapping-modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Edit' : 'Add'} Mapping</h3>
                        <button class="icon-btn close-modal" id="close-mapping-modal">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <form id="mapping-form">
                        <div class="input-group">
                            <label for="mapping-description">Description (Transaction text to match)</label>
                            <input type="text" id="mapping-description" placeholder="E.g., STARBUCKS" value="${mapping ? mapping.description : ''}" required autocomplete="off">
                        </div>
                        <div class="input-group">
                            <label for="mapping-payee">Payee (Optional)</label>
                            <input type="text" id="mapping-payee" placeholder="E.g., Starbucks Coffee" autocomplete="off">
                        </div>
                        <div class="input-group">
                            <label for="mapping-category">Category</label>
                            <select id="mapping-category" required>
                                <option value="">Select category...</option>
                                ${categoryOptions.join('')}
                                <option value="TRANSFER">Transfer</option>
                            </select>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="cancel-mapping">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="save-mapping">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('manual-mapping-modal');
        const form = document.getElementById('mapping-form');
        
        // Make description readonly in edit mode (it's the primary key)
        if (isEdit) {
            document.getElementById('mapping-description').readOnly = true;
            document.getElementById('mapping-description').style.opacity = '0.6';
            
            // Add delete button for edit mode
            let deleteBtn = document.getElementById('delete-mapping-btn');
            if (!deleteBtn) {
                deleteBtn = document.createElement('button');
                deleteBtn.id = 'delete-mapping-btn';
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-icon-danger';
                deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
                deleteBtn.title = 'Delete';
                const modalActions = modal.querySelector('.modal-actions');
                if (modalActions) {
                    modalActions.insertBefore(deleteBtn, modalActions.firstChild);
                }
            }
            deleteBtn.classList.remove('hidden');
            
            // Change save button to checkmark icon
            const saveBtn = document.getElementById('save-mapping');
            if (saveBtn) {
                saveBtn.innerHTML = '<i data-lucide="check"></i>';
                saveBtn.title = 'Save';
            }
        } else {
            // Hide delete button in add mode
            const deleteBtn = document.getElementById('delete-mapping-btn');
            if (deleteBtn) {
                deleteBtn.classList.add('hidden');
            }
            
            // Reset save button text
            const saveBtn = document.getElementById('save-mapping');
            if (saveBtn) {
                saveBtn.innerHTML = 'Save';
                saveBtn.title = '';
            }
        }
        
        if (mapping && mapping.encrypted_payee) {
            const payee = await this.security.decrypt(mapping.encrypted_payee);
            document.getElementById('mapping-payee').value = payee;
        }
        
        // Initialize custom select
        if (!this.mappingCategorySelect) {
            const categorySelectEl = document.getElementById('mapping-category');
            if (categorySelectEl) {
                this.mappingCategorySelect = new CustomSelect(categorySelectEl);
            }
        } else {
            this.mappingCategorySelect.refresh();
        }
        
        // Handle form submission
        const mappingForm = document.getElementById('mapping-form');
        mappingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveMappingFromForm(categories, mapping);
        });
        
        modal.querySelector('#save-mapping').addEventListener('click', async (e) => {
            e.preventDefault();
            await this.saveMappingFromForm(categories, mapping);
        });
        
        modal.querySelector('#cancel-mapping').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close button (X)
        modal.querySelector('#close-mapping-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        // Delete button event listener (will be present if in edit mode)
        if (isEdit) {
            const deleteBtn = modal.querySelector('#delete-mapping-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (confirm(`Delete mapping for "${mapping.description}"?`)) {
                        await this.db.deleteMappingDescription(mapping.description);
                        modal.remove();
                        await this.renderMappingsTab();
                    }
                });
            }
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async saveMappingFromForm(categories, mapping) {
        const description = document.getElementById('mapping-description').value.trim();
        const payee = document.getElementById('mapping-payee').value.trim();
        const categoryValue = document.getElementById('mapping-category').value;
        
        if (!description) {
            alert('Please enter a description');
            return;
        }
        
        if (!categoryValue) {
            alert('Please select a category');
            return;
        }
        
        try {
            let categoryName = 'Transfer';
            
            // Check if Transfer type or regular category
            if (categoryValue !== 'TRANSFER') {
                const categoryId = parseInt(categoryValue);
                const category = categories.find(c => c.id === categoryId);
                if (!category) {
                    alert('Category not found');
                    return;
                }
                categoryName = await this.security.decrypt(category.encrypted_name);
            }
            
            await this.db.setMappingDescription(
                description,
                await this.security.encrypt(categoryName),
                payee ? await this.security.encrypt(payee) : ''
            );
            
            const modal = document.getElementById('manual-mapping-modal');
            if (modal) modal.remove();
            await this.renderMappingsTab();
        } catch (error) {
            console.error('❌ Save mapping failed:', error);
            alert('Failed to save mapping: ' + error.message);
        }
    }

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

    async openMappingsReviewPage(processedMappings) {
        const allCategories = await this.db.getAllCategories();
        
        this.mappingsSearchQuery = '';
        this.mappingsFilterDuplicates = false;
        this.mappingsFilterUnmapped = false;
        this.mappingsFilterCategories = [];
        
        const pageHTML = `
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
            </div>
            
            <div id="mappings-review-list" style="flex: 1; overflow-y: auto; padding: 1rem; padding-bottom: calc(80px + env(safe-area-inset-bottom));">
                ${this.buildMappingsReviewList(processedMappings, allCategories)}
            </div>
            
            <div style="position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 1rem; padding: 1rem; padding-bottom: calc(1rem + env(safe-area-inset-bottom)); background: var(--bg-secondary); border-top: 1px solid var(--border-color); z-index: 100;">
                <button class="btn btn-secondary" id="mappings-review-cancel" style="flex: 1;">Cancel</button>
                <button class="btn btn-primary" id="mappings-review-import" style="flex: 1;">Import Selected</button>
            </div>
        `;
        
        const mappingsPage = document.getElementById('csv-import-page');
        const mappingsContent = document.getElementById('csv-import-content');
        if (!mappingsPage || !mappingsContent) {
            console.error('CSV import page not found');
            return;
        }
        
        mappingsContent.innerHTML = pageHTML;
        
        this.previousTab = this.currentTab || 'mappings';
        
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });
        mappingsPage.classList.remove('hidden');
        mappingsPage.classList.add('active');
        
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) bottomNav.style.display = 'none';
        
        // Hide all FABs (there are multiple)
        document.querySelectorAll('.fab').forEach(fab => fab.classList.add('hidden'));
        
        const modal = mappingsPage;
        
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
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

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

    async handleMappingsImport(processedMappings) {
        const toImport = processedMappings.filter(item => !item.skip && !item.isDuplicate);
        
        if (toImport.length === 0) {
            alert('No mappings selected for import');
            return;
        }
        
        try {
            const imported = await this.csvEngine.importReviewedMappings(toImport);
            alert(`Successfully imported ${imported.length} mapping(s)`);
            
            this.closeMappingsImportPage();
            await this.renderMappingsTab();
        } catch (error) {
            console.error('Mappings import failed:', error);
            alert('Import failed: ' + error.message);
        }
    }

    closeMappingsImportPage() {
        const mappingsPage = document.getElementById('csv-import-page');
        const bottomNav = document.querySelector('.bottom-nav');
        
        if (mappingsPage) {
            mappingsPage.classList.remove('active');
            mappingsPage.classList.add('hidden');
        }
        
        if (bottomNav) bottomNav.style.display = '';
        
        const returnTab = this.previousTab || 'mappings';
        if (this.showTabCallback) {
            this.showTabCallback(returnTab);
        }
    }
}
