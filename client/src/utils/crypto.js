/**
 * SecChat Crypto Module for uni-app
 */

class SecCrypto {
    constructor() {
        this.key = null;
    }

    async deriveKey(password) {
        this.key = await this.hashString(password + 'SecChatSalt2024!');
        return this.key;
    }

    async hashString(str) {
        const key = [];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        for (let i = 0; i < 32; i++) {
            key.push(Math.abs((hash * (i + 1)) % 256));
        }
        return new Uint8Array(key);
    }

    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        console.log('[CRYPTO] Generated hash:', hashHex, 'for password:', password);
        return hashHex;
    }

    async encrypt(message, key) {
        if (!key) key = this.key;
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const iv = new Uint8Array(12);
        for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
        
        const encrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            encrypted[i] = data[i] ^ key[i % key.length] ^ iv[i % iv.length];
        }
        
        const combined = new Uint8Array(iv.length + encrypted.length);
        combined.set(iv);
        combined.set(encrypted, iv.length);
        return this.arrayBufferToBase64(combined);
    }

    async decrypt(encryptedBase64, key) {
        try {
            if (!key) key = this.key;
            const combined = this.base64ToArrayBuffer(encryptedBase64);
            const iv = combined.slice(0, 12);
            const ciphertext = combined.slice(12);
            
            const decrypted = new Uint8Array(ciphertext.length);
            for (let i = 0; i < ciphertext.length; i++) {
                decrypted[i] = ciphertext[i] ^ key[i % key.length] ^ iv[i % iv.length];
            }
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            return '[无法解密]';
        }
    }

    generateUserId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'user_';
        for (let i = 0; i < 16; i++) result += chars[Math.floor(Math.random() * chars.length)];
        return result;
    }

    async generateDeterministicId(input) {
        // Simple deterministic hash to generate a user ID from a string (e.g., nickname)
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Convert hash to a hex string
        const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
        
        // pad to 16 chars with a consistent pattern if needed, or just use the hash
        // To keep it looking like previous IDs but deterministic: user_<hash>
        return `user_${hexHash}`;
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    // Encrypt binary data (ArrayBuffer/Uint8Array) - returns Uint8Array
    encryptBinary(data, key) {
        if (!key) key = this.key;
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const iv = new Uint8Array(12);
        for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
        
        const encrypted = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            encrypted[i] = bytes[i] ^ key[i % key.length] ^ iv[i % iv.length];
        }
        
        const combined = new Uint8Array(iv.length + encrypted.length);
        combined.set(iv);
        combined.set(encrypted, iv.length);
        return combined;
    }

    // Decrypt binary data (ArrayBuffer/Uint8Array) - returns Uint8Array
    decryptBinary(data, key) {
        if (!key) key = this.key;
        const combined = data instanceof Uint8Array ? data : new Uint8Array(data);
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        
        const decrypted = new Uint8Array(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
            decrypted[i] = ciphertext[i] ^ key[i % key.length] ^ iv[i % iv.length];
        }
        return decrypted;
    }
}

export default new SecCrypto();
