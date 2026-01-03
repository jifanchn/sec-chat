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
        const result = [];
        const str = password + 'sha256';
        for (let i = 0; i < 64; i++) {
            const idx = (i * 7 + str.charCodeAt(i % str.length)) % 16;
            result.push('0123456789abcdef'[idx]);
        }
        return result.join('');
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
}

export default new SecCrypto();
