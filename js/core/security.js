/**
 * SecurityManager - Zero-knowledge encryption manager
 * 
 * Handles all cryptographic operations using Web Crypto API:
 * - Password hashing (PBKDF2, 100k iterations)
 * - Key derivation from password
 * - Data encryption/decryption (AES-GCM 256-bit)
 * - Encryption key lifecycle management
 * 
 * SECURITY CONSTRAINTS:
 * - Encryption key exists ONLY in memory (this.encryptionKey)
 * - Plain-text data NEVER touches IndexedDB/localStorage
 * - All decrypt operations require unlocked state (encryptionKey !== null)
 * 
 * @class SecurityManager
 * @module Core/Security
 * @layer 1 - Core Security (Web Crypto API)
 */
export class SecurityManager {
    /**
     * Initialize SecurityManager
     * Sets encryption key to null (locked state)
     * 
     * @constructor
     */
    constructor() {
        /** @type {CryptoKey|null} Encryption key (null when locked) */
        this.encryptionKey = null;
        
        /** @type {number} PBKDF2 iterations for key derivation */
        this.iterations = 100000;
    }

    /**
     * Derive AES-GCM encryption key from password using PBKDF2
     * 
     * @param {string} password - User's password
     * @param {Uint8Array} salt - Random salt (16 bytes)
     * @returns {Promise<CryptoKey>} AES-GCM 256-bit key for encrypt/decrypt
     * @private
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Create password hash for initial setup
     * 
     * Generates random salt and creates PBKDF2 hash.
     * Store returned hash/salt in database for verification.
     * 
     * @param {string} password - User's password
     * @returns {Promise<{hash: string, salt: string}>} Base64-encoded hash and salt
     */
    async createPasswordHash(password) {
        // SECURITY: Generate cryptographically random salt (16 bytes)
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const encoder = new TextEncoder();
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const hash = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            passwordKey,
            256
        );

        return {
            hash: this.arrayBufferToBase64(hash),
            salt: this.arrayBufferToBase64(salt)
        };
    }

    /**
     * Verify password against stored hash
     * 
     * Used during unlock operation to authenticate user.
     * 
     * @param {string} password - Password to verify
     * @param {string} storedHash - Base64-encoded hash from database
     * @param {string} storedSalt - Base64-encoded salt from database
     * @returns {Promise<boolean>} True if password matches
     */
    async verifyPassword(password, storedHash, storedSalt) {
        const salt = this.base64ToArrayBuffer(storedSalt);
        const encoder = new TextEncoder();
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const hash = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            passwordKey,
            256
        );

        const computedHash = this.arrayBufferToBase64(hash);
        return computedHash === storedHash;
    }

    /**
     * Initialize encryption key (unlock the app)
     * 
     * Derives encryption key from password and salt, stores in memory.
     * SECURITY: Key exists ONLY in this.encryptionKey, cleared on lock.
     * 
     * @param {string} password - User's password
     * @param {string|Uint8Array} salt - Salt (Base64 string or Uint8Array)
     * @returns {Promise<void>}
     */
    async initializeEncryption(password, salt) {
        const saltBuffer = typeof salt === 'string' 
            ? this.base64ToArrayBuffer(salt) 
            : salt;
        this.encryptionKey = await this.deriveKey(password, saltBuffer);
    }

    /**
     * Encrypt plaintext data
     * 
     * STATE GUARD: Requires unlocked state (encryptionKey must exist).
     * Uses AES-GCM with random 12-byte IV prepended to ciphertext.
     * 
     * @param {string} plaintext - Data to encrypt
     * @returns {Promise<string>} Base64-encoded encrypted data (IV + ciphertext)
     * @throws {Error} If encryption key not initialized (app is locked)
     */
    async encrypt(plaintext) {
        // STATE GUARD: Requires unlocked state (encryptionKey must exist)
        if (!this.encryptionKey) {
            throw new Error('Encryption key not initialized');
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            data
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return this.arrayBufferToBase64(combined);
    }

    /**
     * Decrypt ciphertext data
     * 
     * STATE GUARD: Requires unlocked state (encryptionKey must exist).
     * Extracts IV from first 12 bytes, decrypts remaining data.
     * 
     * @param {string} ciphertext - Base64-encoded encrypted data
     * @returns {Promise<string>} Decrypted plaintext
     * @throws {Error} If encryption key not initialized (app is locked)
     */
    async decrypt(ciphertext) {
        // STATE GUARD: Requires unlocked state (encryptionKey must exist)
        if (!this.encryptionKey) {
            throw new Error('Encryption key not initialized');
        }

        const combined = this.base64ToArrayBuffer(ciphertext);
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    /**
     * Convert ArrayBuffer to Base64 string
     * 
     * @param {ArrayBuffer} buffer - Binary data
     * @returns {string} Base64-encoded string
     * @private
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to Uint8Array
     * 
     * @param {string} base64 - Base64-encoded string
     * @returns {Uint8Array} Binary data
     * @private
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Clear encryption key (lock the app)
     * 
     * Sets encryptionKey to null, preventing decrypt operations.
     * Call this on logout/lock to secure data.
     * 
     * @returns {void}
     */
    clearEncryptionKey() {
        this.encryptionKey = null;
    }
}
