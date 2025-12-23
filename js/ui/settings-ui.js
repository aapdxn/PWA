// SettingsUI - Handles settings tab rendering
export class SettingsUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    renderSettingsTab() {
        console.log('⚙️ Rendering settings tab');
        const container = document.getElementById('settings-content');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <h3>Settings</h3>
                    <p style="color: var(--text-secondary);">Settings panel coming soon</p>
                </div>
            `;
        }
    }
}
