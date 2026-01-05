<template>
    <view class="login-page">
        <!-- Background decoration -->
        <view class="bg-decoration">
            <view class="bg-circle circle-1"></view>
            <view class="bg-circle circle-2"></view>
        </view>
        
        <view class="login-container">
            <!-- Logo section -->
            <view class="logo-section">
                <view class="logo-icon">
                    <text class="lock-icon">🔐</text>
                </view>
                <text class="brand-name">SecChat</text>
                <text class="brand-tagline">End-to-End Encrypted Messaging</text>
            </view>
            
            <!-- Login form -->
            <view class="form-section">
                <view class="input-group">
                    <view class="input-label">
                        <text class="label-icon">🌐</text>
                        <text class="label-text">SERVER</text>
                    </view>
                    <input
                        class="input-field"
                        v-model="serverUrl"
                        placeholder=""
                        type="text"
                    />
                </view>
                
                <view class="input-group">
                    <view class="input-label">
                        <text class="label-icon">🔑</text>
                        <text class="label-text">PASSWORD</text>
                    </view>
                    <input 
                        class="input-field" 
                        v-model="password" 
                        placeholder="Enter encryption password"
                        placeholder-class="placeholder"
                        type="password"
                    />
                </view>
                
                <view class="input-group">
                    <view class="input-label">
                        <text class="label-icon">👤</text>
                        <text class="label-text">NICKNAME</text>
                    </view>
                    <input 
                        class="input-field" 
                        v-model="nickname" 
                        placeholder="Your display name"
                        placeholder-class="placeholder"
                        type="text"
                    />
                </view>
                
                <button 
                    class="login-btn" 
                    :class="{ loading: loading }"
                    :disabled="loading"
                    @click="handleLogin"
                >
                    <text v-if="!loading" class="btn-text">CONNECT</text>
                    <view v-else class="btn-loading">
                        <view class="spinner"></view>
                        <text>CONNECTING...</text>
                    </view>
                </button>
                
                <view v-if="errorMsg" class="error-box">
                    <text class="error-icon">⚠️</text>
                    <text class="error-text">{{ errorMsg }}</text>
                </view>
            </view>
            
            <!-- Footer -->
            <view class="footer">
                <text class="footer-text">Secure • Private • Encrypted</text>
            </view>
        </view>
    </view>
</template>

<script>
import SecCrypto from '@/utils/crypto.js';
import SecWebSocket from '@/utils/websocket.js';

export default {
    data() {
        return {
            serverUrl: '',
            password: '',
            nickname: '',
            loading: false,
            errorMsg: ''
        };
    },
    onLoad() {
        this.loadCachedCredentials();
        // 如果没有缓存的 serverUrl，使用当前域名作为默认值
        if (!this.serverUrl) {
            this.serverUrl = this.getDefaultServerUrl();
        }
        SecWebSocket.on('auth_success', this.onAuthSuccess);
        SecWebSocket.on('error', this.onError);
    },
    methods: {
        getDefaultServerUrl() {
            // #ifdef H5
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            return `${protocol}//${host}/ws`;
            // #endif
            // #ifndef H5
            return '';
            // #endif
        },
        loadCachedCredentials() {
            try {
                const cached = uni.getStorageSync('secChat_login');
                if (cached) {
                    this.serverUrl = cached.serverUrl || '';
                    this.nickname = cached.nickname || '';
                }
            } catch (e) {
                console.log('No cached credentials');
            }
        },
        
        saveCachedCredentials() {
            try {
                uni.setStorageSync('secChat_login', {
                    serverUrl: this.serverUrl,
                    nickname: this.nickname
                });
            } catch (e) {
                console.error('Cache save failed:', e);
            }
        },
        
        async handleLogin() {
            if (!this.serverUrl.trim()) {
                this.errorMsg = 'Please enter server address';
                return;
            }
            if (!this.password) {
                this.errorMsg = 'Please enter password';
                return;
            }
            if (!this.nickname.trim()) {
                this.errorMsg = 'Please enter nickname';
                return;
            }
            
            this.loading = true;
            this.errorMsg = '';
            
            try {
                // Use deterministic ID based on nickname so that message history is preserved across logins
                const userId = await SecCrypto.generateDeterministicId(this.nickname.trim());
                const encryptionKey = await SecCrypto.deriveKey(this.password);
                const passwordHash = await SecCrypto.hashPassword(this.password);
                
                const app = getApp();
                app.globalData.userId = userId;
                app.globalData.userName = this.nickname.trim();
                app.globalData.serverUrl = this.serverUrl.trim();
                app.globalData.encryptionKey = encryptionKey;
                
                this.saveCachedCredentials();
                
                await SecWebSocket.connect(this.serverUrl.trim());
                SecWebSocket.authenticate(passwordHash, userId, this.nickname.trim());
                
            } catch (error) {
                console.error('Login failed:', error);
                this.errorMsg = error.message || 'Connection failed';
                this.loading = false;
            }
        },
        
        onAuthSuccess(data) {
            this.loading = false;
            uni.redirectTo({ url: '/pages/chat/chat' });
        },
        
        onError(data) {
            this.errorMsg = data.message?.includes('password') ? 'Invalid password' : (data.message || 'Connection failed');
            this.loading = false;
        }
    },
    onUnload() {
        SecWebSocket.off('auth_success', this.onAuthSuccess);
        SecWebSocket.off('error', this.onError);
    }
};
</script>

<style scoped>
.login-page {
    min-height: 100vh;
    background: #0a0a0a;
    position: relative;
    overflow: hidden;
}

.bg-decoration {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.bg-circle {
    position: absolute;
    border-radius: 50%;
    border: 1rpx solid rgba(255, 255, 255, 0.05);
}

.circle-1 {
    width: 600rpx;
    height: 600rpx;
    top: -200rpx;
    right: -200rpx;
}

.circle-2 {
    width: 400rpx;
    height: 400rpx;
    bottom: 100rpx;
    left: -150rpx;
}

.login-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 60rpx 48rpx;
    position: relative;
    z-index: 1;
}

.logo-section {
    text-align: center;
    margin-bottom: 80rpx;
}

.logo-icon {
    width: 120rpx;
    height: 120rpx;
    margin: 0 auto 32rpx;
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    border-radius: 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.lock-icon {
    font-size: 56rpx;
}

.brand-name {
    display: block;
    font-size: 56rpx;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 4rpx;
    margin-bottom: 16rpx;
}

.brand-tagline {
    display: block;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 2rpx;
}

.form-section {
    background: rgba(255, 255, 255, 0.02);
    border: 1rpx solid rgba(255, 255, 255, 0.06);
    border-radius: 32rpx;
    padding: 48rpx 40rpx;
}

.input-group {
    margin-bottom: 40rpx;
}

.input-label {
    display: flex;
    align-items: center;
    margin-bottom: 16rpx;
}

.label-icon {
    font-size: 28rpx;
    margin-right: 12rpx;
}

.label-text {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 3rpx;
    font-weight: 500;
}

.input-field {
    width: 100%;
    padding: 32rpx 0;
    background: transparent;
    border: none;
    border-bottom: 2rpx solid rgba(255, 255, 255, 0.1);
    font-size: 32rpx;
    color: #ffffff;
}

.placeholder {
    color: rgba(255, 255, 255, 0.2);
}

.login-btn {
    width: 100%;
    margin-top: 20rpx;
    padding: 36rpx 0;
    background: #ffffff;
    border: none;
    border-radius: 16rpx;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 4rpx;
    color: #0a0a0a;
}

.login-btn.loading {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
}

.btn-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
}

.spinner {
    width: 32rpx;
    height: 32rpx;
    border: 3rpx solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.error-box {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 32rpx;
    padding: 24rpx;
    background: rgba(255, 59, 48, 0.1);
    border: 1rpx solid rgba(255, 59, 48, 0.2);
    border-radius: 12rpx;
}

.error-icon {
    font-size: 28rpx;
    margin-right: 12rpx;
}

.error-text {
    font-size: 26rpx;
    color: #ff6b6b;
}

.footer {
    text-align: center;
    margin-top: 60rpx;
}

.footer-text {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.2);
    letter-spacing: 2rpx;
}
</style>
