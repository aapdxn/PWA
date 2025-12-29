// AuthUI - Handles authentication UI (Setup & Unlock screens)
export class AuthUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    async handleSetupSubmit() {
        console.log('📝 Processing setup...');
        
        const password = document.getElementById('setup-password')?.value;
        const confirm = document.getElementById('setup-password-confirm')?.value;
        const errorEl = document.getElementById('setup-error');
        
        if (!password || !confirm) {
            console.log('❌ Missing password fields');
            return { success: false };
        }
        
        if (password !== confirm) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.classList.remove('hidden');
            return { success: false };
        }
        
        if (password.length < 8) {
            errorEl.textContent = 'Password must be at least 8 characters';
            errorEl.classList.remove('hidden');
            return { success: false };
        }
        
        try {
            console.log('🔐 Creating password hash...');
            const { hash, salt } = await this.security.createPasswordHash(password);
            
            console.log('💾 Saving to database...');
            await this.db.saveSetting('passwordHash', hash);
            await this.db.saveSetting('passwordSalt', salt);
            
            console.log('🔓 Initializing encryption...');
            await this.security.initializeEncryption(password, salt);
            
            return { success: true };
        } catch (error) {
            console.error('❌ Setup failed:', error);
            errorEl.textContent = 'Setup failed: ' + error.message;
            errorEl.classList.remove('hidden');
            return { success: false };
        }
    }

    async handleUnlockSubmit() {
        console.log('🔓 Processing unlock...');
        
        const password = document.getElementById('unlock-password')?.value;
        const errorEl = document.getElementById('unlock-error');
        
        if (!password) {
            console.log('❌ No password entered');
            return { success: false };
        }
        
        try {
            console.log('🔍 Verifying password...');
            const storedHash = (await this.db.getSetting('passwordHash')).value;
            const storedSalt = (await this.db.getSetting('passwordSalt')).value;
            
            const isValid = await this.security.verifyPassword(password, storedHash, storedSalt);
            
            if (!isValid) {
                errorEl.textContent = 'Incorrect password';
                errorEl.classList.remove('hidden');
                return { success: false };
            }
            
            console.log('✅ Password correct, unlocking...');
            await this.security.initializeEncryption(password, storedSalt);
            
            return { success: true };
        } catch (error) {
            console.error('❌ Unlock failed:', error);
            errorEl.textContent = 'Unlock failed: ' + error.message;
            errorEl.classList.remove('hidden');
            return { success: false };
        }
    }
}
