// ModalManager - Generic modal utilities and category resolution
export class ModalManager {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Show category resolution modal for unmapped categories
     * Returns: { [categoryName]: { categoryId, isNew } } or null if cancelled
     */
    async showCategoryResolutionModal(unmappedCategories) {
        const allCategories = await this.db.getAllCategories();
        
        return new Promise(async (resolve) => {
            const modalHTML = `
                <div class="modal-overlay" id="category-resolution-modal">
                    <div class="modal-content" style="max-width: 600px; max-height: 80vh;">
                        <div class="modal-header">
                            <h2>Categories Not Found</h2>
                        </div>
                        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">The following categories were not found in your budget. Choose how to handle each one:</p>
                            <div id="unmapped-categories-list"></div>
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-secondary" id="resolution-cancel">Cancel</button>
                            <button class="btn btn-primary" id="resolution-confirm">Confirm All</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = document.getElementById('category-resolution-modal');
            const listContainer = document.getElementById('unmapped-categories-list');
            
            // Build list of unmapped categories
            unmappedCategories.forEach((categoryName, index) => {
                const itemHTML = `
                    <div class="unmapped-category-item" style="padding: 1rem; margin-bottom: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px;" data-category="${categoryName}">
                        <div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary);">${categoryName}</div>
                        
                        <div style="margin-bottom: 0.75rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="resolution-${index}" value="existing" checked class="resolution-radio" style="cursor: pointer;">
                                <span style="color: var(--text-primary);">Map to existing category</span>
                            </label>
                            <select class="existing-category-select" data-index="${index}" style="width: 100%; padding: 0.5rem; margin: 0.5rem 0 0 1.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                <option value="" style="background: var(--bg-secondary); color: var(--text-primary);">Select a category...</option>
                            </select>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="resolution-${index}" value="new" class="resolution-radio" style="cursor: pointer;">
                                <span style="color: var(--text-primary);">Create new category "${categoryName}"</span>
                            </label>
                            <select class="new-category-type" data-index="${index}" disabled style="width: 100%; padding: 0.5rem; margin: 0.5rem 0 0 1.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                <option value="" style="background: var(--bg-secondary); color: var(--text-primary);">Select type...</option>
                                <option value="Expense" style="background: var(--bg-secondary); color: var(--text-primary);">Expense</option>
                                <option value="Income" style="background: var(--bg-secondary); color: var(--text-primary);">Income</option>
                                <option value="Saving" style="background: var(--bg-secondary); color: var(--text-primary);">Saving</option>
                            </select>
                        </div>
                    </div>
                `;
                listContainer.insertAdjacentHTML('beforeend', itemHTML);
            });
            
            // Populate existing categories in all dropdowns
            const allSelects = modal.querySelectorAll('.existing-category-select');
            
            if (allCategories.length === 0) {
                console.warn('No categories found in budget - user must create new categories');
                allSelects.forEach(select => {
                    select.innerHTML = '<option value="">No categories yet - create new below</option>';
                    select.disabled = true;
                });
                
                // Auto-select "Create new" option for all items
                modal.querySelectorAll('.unmapped-category-item').forEach(item => {
                    const newRadio = item.querySelector('input[value="new"]');
                    const existingRadio = item.querySelector('input[value="existing"]');
                    if (newRadio && existingRadio) {
                        newRadio.checked = true;
                        existingRadio.disabled = true;
                        item.querySelector('.existing-category-select').disabled = true;
                        item.querySelector('.new-category-type').disabled = false;
                    }
                });
            } else {
                // Populate dropdowns with existing categories
                for (const cat of allCategories) {
                    const name = await this.security.decrypt(cat.encrypted_name);
                    allSelects.forEach(select => {
                        const option = document.createElement('option');
                        option.value = cat.id;
                        option.textContent = `${name} (${cat.type})`;
                        option.style.background = 'var(--bg-secondary)';
                        option.style.color = 'var(--text-primary)';
                        option.style.fontSize = '14px';
                        select.appendChild(option);
                    });
                }
            }
            
            // Radio button toggle handlers
            modal.querySelectorAll('.resolution-radio').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const item = e.target.closest('.unmapped-category-item');
                    const existingSelect = item.querySelector('.existing-category-select');
                    const newTypeSelect = item.querySelector('.new-category-type');
                    
                    if (e.target.value === 'existing') {
                        existingSelect.disabled = false;
                        newTypeSelect.disabled = true;
                        newTypeSelect.value = '';
                    } else {
                        existingSelect.disabled = true;
                        existingSelect.value = '';
                        newTypeSelect.disabled = false;
                    }
                });
            });
            
            // Cancel button
            modal.querySelector('#resolution-cancel').addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });
            
            // Confirm button
            modal.querySelector('#resolution-confirm').addEventListener('click', async () => {
                const resolutions = {};
                
                for (let i = 0; i < unmappedCategories.length; i++) {
                    const categoryName = unmappedCategories[i];
                    const item = modal.querySelector(`[data-category="${categoryName}"]`);
                    const selectedOption = item.querySelector('input[type="radio"]:checked').value;
                    
                    if (selectedOption === 'existing') {
                        const existingSelect = item.querySelector('.existing-category-select');
                        const categoryId = existingSelect.value;
                        if (!categoryId) {
                            alert(`Please select a category for "${categoryName}"`);
                            return;
                        }
                        resolutions[categoryName] = { categoryId: parseInt(categoryId), isNew: false };
                    } else {
                        const newTypeSelect = item.querySelector('.new-category-type');
                        const type = newTypeSelect.value;
                        if (!type) {
                            alert(`Please select a type for "${categoryName}"`);
                            return;
                        }
                        
                        // Create new category
                        const newCategoryId = await this.db.saveCategory({
                            encrypted_name: await this.security.encrypt(categoryName),
                            encrypted_limit: await this.security.encrypt('0'),
                            type: type
                        });
                        
                        resolutions[categoryName] = { categoryId: newCategoryId, isNew: true, type };
                    }
                }
                
                modal.remove();
                resolve(resolutions);
            });
        });
    }
}
