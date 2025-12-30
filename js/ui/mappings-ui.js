/**
 * Mappings UI - Coordinator for mappings functionality
 * Delegates to specialized modules for rendering, forms, and import
 * 
 * @module MappingsUI
 */

import { MappingsRenderer } from './mappings-renderer.js';
import { MappingsForm } from './mappings-form.js';
import { MappingsImportHandler } from './mappings-import-handler.js';

export class MappingsUI {
    constructor(security, db, csvEngine, modalManager) {
        this.security = security;
        this.db = db;
        this.csvEngine = csvEngine;
        this.modalManager = modalManager;
        
        // Initialize specialized modules
        this.renderer = new MappingsRenderer(security, db);
        this.form = new MappingsForm(security, db);
        this.importHandler = new MappingsImportHandler(security, db, csvEngine, modalManager);
        
        // Set callbacks for module communication
        this.form.onMappingChanged = async () => await this.renderMappingsTab();
        this.importHandler.onMappingsImported = async () => await this.renderMappingsTab();
        this.importHandler.showTabCallback = (tab) => {
            if (this.showTabCallback) {
                this.showTabCallback(tab);
            }
        };
        
        // Parent UI Manager callback
        this.showTabCallback = null;
    }

    /**
     * Render mappings tab (delegates to MappingsRenderer)
     */
    async renderMappingsTab() {
        await this.renderer.renderMappingsTab();
        this.importHandler.initializeFileInput();
    }

    /**
     * Toggle FAB menu (delegates to MappingsForm)
     */
    toggleMappingFabMenu() {
        this.form.toggleMappingFabMenu();
    }

    /**
     * Open mapping for edit (delegates to MappingsForm)
     */
    async openMappingForEdit(description) {
        await this.form.openMappingForEdit(description);
    }

    /**
     * Show manual mapping modal (delegates to MappingsForm)
     */
    async showManualMappingModal(mapping = null) {
        await this.form.showManualMappingModal(mapping);
    }
}
