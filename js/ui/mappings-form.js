/**
 * Mappings Form - Modal management for creating/editing mappings
 * Handles the manual mapping modal, form submission, and deletion
 * 
 * @module MappingsForm
 */

import { CustomSelect } from './custom-select.js';

export class MappingsForm {
    constructor(security, db) {
        this.security = security;
        this.db = db;
        this.mappingCategorySelect = null;
    }

    /**
     * Open mapping for editing
     */
    async openMappingForEdit(description) {
        const allMappings = await this.db.getAllMappingsDescriptions();
        const mapping = allMappings.find(m => m.description === description);
        
        if (!mapping) {
            console.error('Mapping not found:', description);
            return;
        }
        
        // Decrypt the mapping data
        const categoryName = mapping.encrypted_category 
            ? await this.security.decrypt(mapping.encrypted_category) 
            : '';
        const payeeName = mapping.encrypted_payee 
            ? await this.security.decrypt(mapping.encrypted_payee) 
            : '';
        
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

    /**
     * Show manual mapping modal (add or edit)
     */
    async showManualMappingModal(mapping = null) {
        const categories = await this.db.getAllCategories();
        const isEdit = !!mapping;
        
        const categoryOptions = await Promise.all(categories.map(async (cat) => {
            const name = await this.security.decrypt(cat.encrypted_name);
            return `<option value="${cat.id}">${name} (${cat.type})</option>`;
        }));
        
        const modalHTML = this.buildModalHTML(isEdit, mapping, categoryOptions);
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('manual-mapping-modal');
        
        this.setupModalBehavior(modal, isEdit, mapping);
        
        if (mapping && mapping.encrypted_payee) {
            const payee = await this.security.decrypt(mapping.encrypted_payee);
            document.getElementById('mapping-payee').value = payee;
        }
        
        this.initializeCustomSelect();
        this.attachFormEvents(modal, categories, mapping);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        return modal;
    }

    /**
     * Build modal HTML
     * @private
     */
    buildModalHTML(isEdit, mapping, categoryOptions) {
        return `
            <div class="modal-overlay" id="manual-mapping-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Edit' : 'Add'} Mapping</h3>
                        <button class="icon-btn close-modal" id="close-mapping-modal">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <div class="modal-body">
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
                        </form>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" id="cancel-mapping">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="save-mapping">Save</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup modal-specific behavior (readonly description in edit mode, delete button)
     * @private
     */
    setupModalBehavior(modal, isEdit, mapping) {
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
            const deleteBtn = document.getElementById('delete-mapping-btn');
            if (deleteBtn) {
                deleteBtn.classList.add('hidden');
            }
            
            const saveBtn = document.getElementById('save-mapping');
            if (saveBtn) {
                saveBtn.innerHTML = 'Save';
                saveBtn.title = '';
            }
        }
    }

    /**
     * Initialize custom select
     * @private
     */
    initializeCustomSelect() {
        if (!this.mappingCategorySelect) {
            const categorySelectEl = document.getElementById('mapping-category');
            if (categorySelectEl) {
                this.mappingCategorySelect = new CustomSelect(categorySelectEl);
            }
        } else {
            this.mappingCategorySelect.refresh();
        }
    }

    /**
     * Attach form events
     * @private
     */
    attachFormEvents(modal, categories, mapping) {
        const isEdit = !!mapping;
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
        
        modal.querySelector('#close-mapping-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        if (isEdit) {
            const deleteBtn = modal.querySelector('#delete-mapping-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (confirm(`Delete mapping for "${mapping.description}"?`)) {
                        await this.db.deleteMappingDescription(mapping.description);
                        modal.remove();
                        // Callback to parent to re-render
                        if (this.onMappingChanged) {
                            await this.onMappingChanged();
                        }
                    }
                });
            }
        }
    }

    /**
     * Save mapping from form
     */
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
            
            // Callback to parent to re-render
            if (this.onMappingChanged) {
                await this.onMappingChanged();
            }
        } catch (error) {
            console.error('❌ Save mapping failed:', error);
            alert('Failed to save mapping: ' + error.message);
        }
    }

    /**
     * Toggle FAB menu
     */
    toggleMappingFabMenu() {
        const menu = document.getElementById('fab-mapping-menu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    }
}
