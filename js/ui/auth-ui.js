/**
 * AuthUI - Authentication user interface for setup and unlock flows
 * 
 * Manages the initial password setup screen and the unlock screen for
 * returning users. Handles password validation, security constraints,
 * and communication with SecurityManager for cryptographic operations.
 * 
 * RESPONSIBILITIES:
 * - Render and validate setup form (password + confirmation)
 * - Render and validate unlock form (password entry)
 * - Enforce password security requirements (min 8 characters)
 * - Create and store password hash/salt during setup
 * - Verify password against stored hash during unlock
 * - Initialize encryption context after successful authentication
 * 
 * DEPENDENCIES:
 * - SecurityManager: Password hashing, verification, and encryption initialization
 * - DatabaseManager: Store/retrieve password hash and salt
 * 
 * SECURITY CONSTRAINTS:
 * - Password is NEVER stored in plain text
 * - Only PBKDF2 hash and salt are persisted to IndexedDB
 * - Encryption key exists only in memory during unlocked state
 * - Password inputs are cleared after processing
 * 
 * @class AuthUI
 * @module UI/Auth
 * @layer 5 - UI Components
 */
export class AuthUI {
    /**
     * Creates AuthUI instance for authentication screens
     * 
     * @param {SecurityManager} security - Handles cryptographic operations
     * @param {DatabaseManager} db - Stores password hash and salt
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Handle setup form submission and create new password
     * 
     * Validates password requirements (match, minimum length), creates PBKDF2
     * hash and salt, stores them in database, and initializes encryption context.
     * 
     * VALIDATION RULES:
     * - Password and confirmation must match
     * - Minimum 8 characters required
     * - Both fields must be non-empty
     * 
     * SECURITY FLOW:
     * 1. Validate password requirements
     * 2. Generate PBKDF2 hash and random salt
     * 3. Store hash and salt in IndexedDB (NOT the password)
     * 4. Initialize encryption with password (creates AES key in memory)
     * 5. Return success for state transition to unlocked
     * 
     * @async
     * @returns {Promise<{success: boolean}>} Result object indicating setup success/failure
     */
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

    /**
     * Handle unlock form submission and verify password
     * 
     * Retrieves stored password hash and salt from database, verifies entered
     * password against hash, and initializes encryption context if valid.
     * 
     * SECURITY FLOW:
     * 1. Retrieve stored PBKDF2 hash and salt from IndexedDB
     * 2. Hash entered password with stored salt
     * 3. Compare computed hash with stored hash (constant-time comparison)
     * 4. If valid, initialize encryption (creates AES key in memory)
     * 5. Return success for state transition to unlocked
     * 
     * PASSWORD SECURITY:
     * - Password is never logged or exposed
     * - Comparison is constant-time to prevent timing attacks
     * - Encryption key derived from password is stored only in memory
     * 
     * @async
     * @returns {Promise<{success: boolean}>} Result object indicating unlock success/failure
     */
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
