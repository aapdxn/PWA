// CustomSelect - Creates collapsible, scrollable dropdowns
export class CustomSelect {
    constructor(selectElement) {
        this.select = selectElement;
        this.isOpen = false;
        this.selectedOption = null;
        this.init();
    }

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

    selectOption(index) {
        this.select.selectedIndex = index;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        this.updateDisplay();
        this.close();
    }

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

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

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

    close() {
        this.isOpen = false;
        this.wrapper.classList.remove('open');
    }

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

    refresh() {
        this.populate();
    }

    destroy() {
        this.select.style.display = '';
        this.wrapper.parentNode.insertBefore(this.select, this.wrapper);
        this.wrapper.remove();
    }
}
