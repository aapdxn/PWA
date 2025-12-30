/**
 * CSV Review Filter - Handles filtering, sorting, and search logic for CSV review
 * 
 * @module CSVReviewFilter
 */

import { CustomSelect } from './custom-select.js';

export class CSVReviewFilter {
    constructor() {
        // Search/Filter state
        this.csvSearchQuery = '';
        this.csvFilterDuplicates = false;
        this.csvFilterUnmapped = false;
        this.csvFilterAuto = false;
        
        // Custom select instances
        this.csvCategorySelects = [];
    }

    /**
     * Apply filters and sorting to CSV review items
     */
    applyFiltersAndSort(modal, processedData) {
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
            this.initializeCustomSelects();
        }
        
        // Update count
        const visibleCount = document.getElementById('csv-visible-count');
        if (visibleCount) {
            visibleCount.textContent = visibleItems.length;
        }
    }

    /**
     * Clear all filters and reset to default state
     */
    clearAllFilters() {
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
    }

    /**
     * Initialize custom selects for category dropdowns
     */
    initializeCustomSelects() {
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

    /**
     * Skip all visible CSV items
     */
    skipAllVisibleItems(modal, processedData) {
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

    /**
     * Reset filter state
     */
    resetState() {
        this.csvSearchQuery = '';
        this.csvFilterDuplicates = false;
        this.csvFilterUnmapped = false;
        this.csvFilterAuto = false;
    }
}
