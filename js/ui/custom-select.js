/**
 * CustomSelect - Enhanced dropdown component with search and scrolling
 * 
 * Replaces native <select> elements with custom-styled dropdowns that support
 * collapsing, scrolling, keyboard navigation, and visual consistency across
 * browsers and platforms. Particularly useful for iOS where native selects
 * have limited styling options.
 * 
 * RESPONSIBILITIES:
 * - Transform native <select> into custom dropdown UI
 * - Handle open/close state with visual feedback
 * - Maintain selection state synchronized with native select
 * - Support click-outside-to-close behavior
 * - Position dropdown to avoid viewport overflow
 * - Scroll to selected option when opened
 * - Provide refresh method for dynamic option updates
 * 
 * DEPENDENCIES:
 * - Lucide icons for chevron indicator
 * 
 * DOM STRUCTURE:
 * - Wraps original <select> in .custom-select container
 * - Creates .custom-select-display button for current selection
 * - Creates .custom-select-dropdown for options list
 * - Hides native select but keeps it for value storage
 * 
 * LIFECYCLE:
 * 1. init() - Create custom UI elements, hide native select
 * 2. populate() - Generate dropdown items from select options
 * 3. User clicks display → open() → Position and show dropdown
 * 4. User clicks option → selectOption() → Update native select, close dropdown
 * 5. Native select changes → updateDisplay() → Sync custom UI
 * 
 * SEARCH FUNCTIONALITY:
 * Can be extended with search input for filtering large option lists.
 * 
 * @class CustomSelect
 * @module UI/Components
 * @layer 5 - UI Components
 */
export class CustomSelect {
    /**
     * Creates CustomSelect instance and initializes custom dropdown UI
     * 
     * Replaces the provided native select element with custom-styled dropdown.
     * Native select remains in DOM (hidden) to maintain form compatibility.
     * 
     * @param {HTMLSelectElement} selectElement - Native select element to enhance
     */
    constructor(selectElement) {
        this.select = selectElement;
        this.isOpen = false;
        this.selectedOption = null;
        this.init();
    }

    /**
     * Initialize custom dropdown UI and attach event listeners
     * 
     * Creates wrapper, display button, and dropdown container. Hides native
     * select but keeps it in DOM for value storage and form compatibility.
     * Attaches listeners for toggle, outside click, and sync with native select.
     * 
     * DOM CREATION:
     * 1. Create .custom-select wrapper div
     * 2. Create .custom-select-display button with text and chevron icon
     * 3. Create .custom-select-dropdown container for options
     * 4. Insert wrapper before native select
     * 5. Move native select inside wrapper and hide it
     * 
     * EVENT BINDINGS:
     * - Display click: Toggle dropdown open/close
     * - Document click: Close dropdown if clicking outside
     * - Native select change: Sync custom display
     * 
     * @private
     */
    init() {
        // Create custom dropdown container
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-select';
        
        // Create display button
        this.display = document.createElement('button');
        this.display.type = 'button';
        this.display.className = 'custom-select-display';
        this.display.innerHTML = '<span class="custom-select-text">Select...</span><i data-lucide="chevron-down" class="custom-select-arrow"></i>';
        
        // Create dropdown list
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-select-dropdown';
        
        // Insert custom elements
        this.select.parentNode.insertBefore(this.wrapper, this.select);
        this.wrapper.appendChild(this.display);
        this.wrapper.appendChild(this.dropdown);
        this.wrapper.appendChild(this.select);
        
        // Hide native select
        this.select.style.display = 'none';
        
        // Event listeners
        this.display.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });
        
        // Update display when native select changes
        this.select.addEventListener('change', () => {
            this.updateDisplay();
        });
        
        // Initial population
        this.populate();
    }

    /**
     * Generate dropdown items from native select options
     * 
     * Reads all options from native select and creates clickable div elements
     * in dropdown. Each item stores value and index as data attributes.
     * Updates display to show current selection.
     * 
     * Called during init() and can be called again via refresh() when
     * options are dynamically updated.
     * 
     * @public
     */
    populate() {
        const options = Array.from(this.select.options);
        this.dropdown.innerHTML = '';
        
        options.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'custom-select-option';
            item.textContent = option.textContent;
            item.dataset.value = option.value;
            item.dataset.index = index;
            
            if (option.value === this.select.value) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectOption(index);
            });
            
            this.dropdown.appendChild(item);
        });
        
        this.updateDisplay();
    }

    /**
     * Select option by index and update native select
     * 
     * Updates native select's selectedIndex, dispatches change event for
     * form handling, updates custom display, and closes dropdown.
     * 
     * EVENT DISPATCH: Triggers 'change' event with bubbles: true so
     * parent forms and listeners can detect the change.
     * 
     * @public
     * @param {number} index - Index of option to select (0-based)
     */
    selectOption(index) {
        this.select.selectedIndex = index;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        this.updateDisplay();
        this.close();
    }

    /**
     * Update custom display button text to match native select value
     * 
     * Syncs custom dropdown display with native select's current selection.
     * Adds .has-value class when non-empty option selected.
     * Updates .selected class on dropdown items for visual feedback.
     * 
     * Called automatically when:
     * - User selects option via custom dropdown
     * - Native select changes programmatically
     * - Options are repopulated
     * 
     * @public
     */
    updateDisplay() {
        const selectedOption = this.select.options[this.select.selectedIndex];
        const textSpan = this.display.querySelector('.custom-select-text');
        
        if (selectedOption && selectedOption.value) {
            textSpan.textContent = selectedOption.textContent;
            this.display.classList.add('has-value');
        } else {
            textSpan.textContent = selectedOption ? selectedOption.textContent : 'Select...';
            this.display.classList.remove('has-value');
        }
        
        // Update selected state in dropdown
        this.dropdown.querySelectorAll('.custom-select-option').forEach((item, idx) => {
            if (idx === this.select.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Toggle dropdown between open and closed states
     * 
     * @public
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open dropdown with positioning and scrolling
     * 
     * Closes other open custom selects first (only one open at a time).
     * Positions dropdown above or below based on viewport space.
     * Scrolls to currently selected option for easy visibility.
     * Refreshes Lucide icons in dropdown content.
     * 
     * POSITIONING LOGIC:
     * - Measures space below and above dropdown trigger
     * - If insufficient space below, positions above if possible
     * - See positionDropdown() for details
     * 
     * @public
     */
    open() {
        // Close other custom selects
        document.querySelectorAll('.custom-select.open').forEach(el => {
            if (el !== this.wrapper) {
                el.classList.remove('open');
            }
        });
        
        this.isOpen = true;
        this.wrapper.classList.add('open');
        
        // Position dropdown to avoid going off screen
        this.positionDropdown();
        
        // Scroll to selected option
        const selected = this.dropdown.querySelector('.custom-select-option.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
        
        // Initialize icons if lucide is available
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Close dropdown and update state
     * 
     * @public
     */
    close() {
        this.isOpen = false;
        this.wrapper.classList.remove('open');
    }

    /**
     * Position dropdown to avoid viewport overflow
     * 
     * Calculates available space above and below the trigger button.
     * If dropdown would overflow bottom of viewport and there's more
     * space above, positions dropdown above the trigger instead.
     * 
     * MAX HEIGHT: 250px or actual content height, whichever is smaller.
     * 
     * POSITIONING:
     * - Default: Below trigger (top: 100%, marginTop: 4px)
     * - Overflow: Above trigger (bottom: 100%, marginBottom: 4px)
     * 
     * @private
     */
    positionDropdown() {
        const rect = this.wrapper.getBoundingClientRect();
        const dropdownHeight = Math.min(250, this.dropdown.scrollHeight);
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Position above if not enough space below
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
            this.dropdown.style.bottom = '100%';
            this.dropdown.style.top = 'auto';
            this.dropdown.style.marginBottom = '4px';
            this.dropdown.style.marginTop = '0';
        } else {
            this.dropdown.style.top = '100%';
            this.dropdown.style.bottom = 'auto';
            this.dropdown.style.marginTop = '4px';
            this.dropdown.style.marginBottom = '0';
        }
    }

    /**
     * Refresh dropdown items from native select options
     * 
     * Call this method when options are dynamically added/removed from
     * the native select to rebuild the custom dropdown.
     * 
     * @public
     */
    refresh() {
        this.populate();
    }

    /**
     * Destroy custom dropdown and restore native select
     * 
     * Removes custom UI elements and restores native select visibility.
     * Use for cleanup or reverting to native select behavior.
     * 
     * @public
     */
    destroy() {
        this.select.style.display = '';
        this.wrapper.parentNode.insertBefore(this.select, this.wrapper);
        this.wrapper.remove();
    }
}
