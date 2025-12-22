class SecurityManager {
    constructor() {
        this.encryptionKey = null;
        this.iterations = 100000;
    }

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

    async createPasswordHash(password) {
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

    async initializeEncryption(password, salt) {
        const saltBuffer = typeof salt === 'string' 
            ? this.base64ToArrayBuffer(salt) 
            : salt;
        this.encryptionKey = await this.deriveKey(password, saltBuffer);
    }

    async encrypt(plaintext) {
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

    async decrypt(ciphertext) {
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

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    clearKey() {
        this.encryptionKey = null;
    }
}
