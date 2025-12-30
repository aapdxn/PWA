/**
 * MappingsUI - Mappings Management Coordinator
 * 
 * WORKFLOW:
 * 1. Display all description mappings in searchable/filterable list
 * 2. User can add/edit/delete mappings manually
 * 3. User can import mappings from CSV file
 * 4. Auto-categorization uses mappings for future CSV imports
 * 
 * RESPONSIBILITIES:
 * - Coordinate mappings functionality across modules
 * - Delegate rendering to MappingsRenderer
 * - Delegate form handling to MappingsForm
 * - Delegate CSV import to MappingsImportHandler
 * - Manage callbacks between modules
 * - Expose public API for parent UI Manager
 * 
 * MODULE COMPOSITION:
 * - MappingsRenderer: Display and filtering logic
 * - MappingsForm: Modal for creating/editing mappings
 * - MappingsImportHandler: CSV import and review
 * 
 * @class MappingsUI
 * @module UI/Mappings
 * @layer 5 - UI Components
 */

import { MappingsRenderer } from './mappings-renderer.js';
import { MappingsForm } from './mappings-form.js';
import { MappingsImportHandler } from './mappings-import-handler.js';

export class MappingsUI {
    /**
     * Initialize mappings UI coordinator
     * Creates specialized modules and sets up inter-module callbacks
     * 
     * @param {SecurityManager} security - Web Crypto API wrapper for encryption
     * @param {DatabaseManager} db - Dexie database interface
     * @param {CSVEngine} csvEngine - CSV processing for mappings import
     * @param {ModalManager} modalManager - For category resolution modals
     */
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
     * Render mappings tab
     * Delegates to MappingsRenderer and initializes CSV import file input
     * 
     * @returns {Promise<void>}
     */
    async renderMappingsTab() {
        await this.renderer.renderMappingsTab();
        this.importHandler.initializeFileInput();
    }

    /**
     * Toggle FAB menu
     * Delegates to MappingsForm for menu display control
     * 
     * @returns {void}
     */
    toggleMappingFabMenu() {
        this.form.toggleMappingFabMenu();
    }

    /**
     * Open mapping for edit
     * Delegates to MappingsForm to show edit modal with pre-filled data
     * 
     * @param {string} description - Description key to edit
     * @returns {Promise<void>}
     */
    async openMappingForEdit(description) {
        await this.form.openMappingForEdit(description);
    }

    /**
     * Show manual mapping modal
     * Delegates to MappingsForm for add/edit modal display
     * 
     * @param {Object|null} mapping - Existing mapping data for edit mode, null for add mode
     * @returns {Promise<void>}
     */
    async showManualMappingModal(mapping = null) {
        await this.form.showManualMappingModal(mapping);
    }
}
