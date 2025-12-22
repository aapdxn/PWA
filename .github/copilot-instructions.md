# Copilot Instructions: Vault Budget (Secure, Local-First PWA)

You are acting as a Senior Frontend Architect and Security Specialist. All code generated for this project must strictly adhere to these architectural and security constraints.

## 1. Core Architecture
- **Environment:** Strictly Client-Side (No Node.js, No Firebase, No Backend).
- **Persistence:** IndexedDB via Dexie.js (CDN).
- **Offline Support:** Service Worker (sw.js) for PWA functionality.
- **Platform Focus:** iOS Safari (PWA "Add to Home Screen" optimized).

## 2. Security & Encryption Standards (Non-Negotiable)
- **Engine:** Use the native Web Crypto API (window.crypto.subtle).
- **Key Derivation:** Use PBKDF2 with at least 100,000 iterations and a random salt to derive keys from the user's master password.
- **Encryption Algorithm:** AES-GCM 256-bit.
- **Zero-Knowledge:** Plain-text data must NEVER be stored in IndexedDB or LocalStorage. All financial data must be encrypted before storage and decrypted only in memory during the "Unlocked" state.
- **Password Safety:** Do not store the password. Store only a salted PBKDF2 hash for verification.

## 3. Database Schema (Dexie.js)
- **Settings Table:** `{ key, value }` (Stores salted password hash and UI preferences).
- **Categories Table:** `{ id, encrypted_name, encrypted_limit }`.
- **Transactions Table:** `{ id, encrypted_date, encrypted_amount, categoryId, encrypted_note, encrypted_custom_fields }`.
- **Relational Logic:** Use categoryId as a foreign key to link transactions to categories.

## 4. UI/UX Requirements
- **Aesthetic:** Native iOS "San Francisco" font stack, safe-area-insets (handling the notch), and "standalone" PWA display.
- **Interactions:** Mobile-first, bottom-aligned navigation, prevent zoom on input focus.
- **State Management:** Handle three distinct application states:
  1. Setup (First run, set password).
  2. Locked (Password entry required).
  3. Unlocked (Decrypted session active).

## 5. Development Guidelines
- Use Vanilla JavaScript (ES6+).
- Use modular Class-based structures: `SecurityManager`, `DatabaseManager`, and `UIManager`.
- Ensure all external libraries (Dexie, Lucide, PapaParse) are called via CDN.
