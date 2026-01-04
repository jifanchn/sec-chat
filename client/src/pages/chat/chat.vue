<template>
    <view class="chat-page">
        <view class="chat-header">
            <view class="header-left">
                <text class="header-title">SecChat</text>
                <text class="member-count">{{ onlineCount }}人在线</text>
            </view>
            <view class="header-right">
                <view class="icon-btn" @click="goToMembers">👥</view>
                <view class="icon-btn" @click="handleLogout" style="margin-left: 10rpx;">🚪</view>
            </view>
        </view>
        
        <scroll-view class="messages-container" scroll-y :scroll-top="scrollTop" :scroll-into-view="scrollToId" @scrolltoupper="loadMore">
            <view class="messages-list">
                <view v-if="hasMore" class="loading-more">
                    <text>正在加载更多消息...</text>
                </view>
                <view v-for="(msg, index) in messages" :key="msg.id" :id="'msg-' + msg.id">
                    <view v-if="shouldShowTime(index)" class="time-divider">
                        <text style="color: #666;">{{ formatDate(msg.timestamp) }}</text>
                    </view>
                    
                    <view v-if="msg.type === 'system'" class="system-message">
                        <text>{{ msg.content }}</text>
                    </view>
                    
                    <view v-else class="message" :class="{ self: isMessageSelf(msg) }" @longpress="showContextMenu($event, msg)">
                        <view class="message-avatar"><text>{{ getAvatarChar(msg.fromName) }}</text></view>
                        <view class="message-content">
                            <view class="message-header">
                                <text class="message-name">{{ msg.fromName }}</text>
                                <text class="message-time">{{ formatTime(msg.timestamp) }}</text>
                            </view>
                            <view v-if="msg.replyTo" class="message-reply">
                                <text>{{ getReplyPreview(msg.replyTo) }}</text>
                            </view>
                            <view class="message-bubble" :class="{ image: msg.type === 'image' }">
                                <template v-if="msg.recalled">
                                    <text class="recalled-text">{{ msg.fromName }} 撤回了消息</text>
                                </template>
                                <template v-else-if="msg.type === 'image'">
                                    <image :src="msg.decryptedContent" mode="widthFix" @click="previewImage(msg.decryptedContent)"/>
                                </template>
                                <template v-else>
                                    <text>{{ msg.decryptedContent }}</text>
                                </template>
                            </view>
                        </view>
                    </view>
                </view>
            </view>
        </scroll-view>
        
        <view v-if="typingUser" class="typing-indicator">
            <text>{{ typingUser }} 正在输入...</text>
        </view>
        
        <view v-if="replyingTo" class="reply-preview">
            <text class="reply-label">回复: {{ getReplyPreview(replyingTo.id) }}</text>
            <text class="close-btn" @click="cancelReply">×</text>
        </view>
        
        <view class="input-area">
            <view class="input-toolbar">
                <view class="tool-btn" @click="showEmojiPicker = true">😊</view>
                <view class="tool-btn" @click="chooseImage">📷</view>
            </view>
            <view class="input-wrapper">
                <textarea class="message-input" v-model="inputText" placeholder="输入消息..." :auto-height="true" @confirm="sendMessage" @keydown.enter.exact.prevent="sendMessage"/>
                <view class="send-btn" :class="{ active: inputText.trim() }" @click="sendMessage">发送</view>
            </view>
        </view>
        
        <view v-if="showEmojiPicker" class="emoji-picker">
            <view class="emoji-grid">
                <view v-for="emoji in emojis" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</view>
            </view>
            <view class="emoji-close" @click="showEmojiPicker = false">关闭</view>
        </view>
        
        <view v-if="contextMenu.visible" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
            <view class="menu-item" @click="handleContextAction('copy')">复制</view>
            <view class="menu-item" @click="handleContextAction('reply')">回复</view>
            <view v-if="contextMenu.message?.from === userId" class="menu-item" @click="handleContextAction('recall')">撤回</view>
        </view>
        <view v-if="contextMenu.visible" class="context-overlay" @click="hideContextMenu"></view>
    </view>
</template>

<script>
import SecCrypto from '@/utils/crypto.js';
import SecWebSocket from '@/utils/websocket.js';

export default {
    data() {
        return {
            userId: '', userName: '', encryptionKey: null,
            messages: [], members: [],
            inputText: '', scrollTop: 0, scrollToId: '',
            replyingTo: null, typingUser: null, typingTimeout: null, lastTypingSent: 0,
            showEmojiPicker: false, isLoading: false, hasMore: true,
            contextMenu: { visible: false, x: 0, y: 0, message: null },
            emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😍','🥰','😘','👍','👎','👌','❤️','💔','🎉']
        };
    },
    computed: {
        onlineCount() { return this.members.filter(m => m.online).length; }
    },
    onLoad() {
        const app = getApp();
        this.userId = app.globalData.userId;
        this.userName = app.globalData.userName;
        this.encryptionKey = app.globalData.encryptionKey;
        this.messages = [];
        
        SecWebSocket.on('message', this.onMessage);
        SecWebSocket.on('system', this.onSystemMessage);
        SecWebSocket.on('typing', this.onTyping);
        SecWebSocket.on('recall', this.onRecall);
        SecWebSocket.on('users', this.onUsers);
        SecWebSocket.on('disconnected', this.onDisconnected);
        
        this.loadHistory();
        this.loadMembers();  // Load members on init
    },
    methods: {
        async loadHistory() {
            if (this.isLoading) return;
            this.isLoading = true;
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                const response = await uni.request({ url: `${httpUrl}/api/messages?limit=50`, method: 'GET' });
                let err = null, res = null;
                if (Array.isArray(response)) { [err, res] = response; }
                else { res = response; }

                if (!err && res.data?.messages) {
                    const newMessages = res.data.messages;
                    for (const msg of newMessages) {
                        await this.decryptMessage(msg);
                    }
                    this.messages = newMessages;
                    this.hasMore = res.data.hasMore;
                    this.$nextTick(() => this.scrollToBottom());
                } else {
                    console.error('Load history response error:', err, res);
                }
            } catch (error) { 
                console.error('Load history exception:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
            finally { this.isLoading = false; }
        },
        async loadMore() {
            if (this.isLoading || !this.hasMore || this.messages.length === 0) return;
            this.isLoading = true;
            try {
                const app = getApp();
                const firstMsg = this.messages[0];
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                const response = await uni.request({ url: `${httpUrl}/api/messages?limit=50&before=${firstMsg.timestamp}`, method: 'GET' });
                let err = null, res = null;
                if (Array.isArray(response)) { [err, res] = response; }
                else { res = response; }

                if (!err && res.data?.messages) {
                    const olderMessages = res.data.messages;
                    for (const msg of olderMessages) {
                        await this.decryptMessage(msg);
                    }
                    if (olderMessages.length > 0) {
                        this.messages = [...olderMessages, ...this.messages];
                        this.scrollToId = 'msg-' + firstMsg.id;
                    }
                    this.hasMore = res.data.hasMore;
                }
            } catch (error) { console.error('Load more failed:', error); }
            finally { this.isLoading = false; }
        },
        async loadMembers() {
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                const response = await uni.request({ url: `${httpUrl}/api/members`, method: 'GET' });
                let err = null, res = null;
                if (Array.isArray(response)) { [err, res] = response; }
                else { res = response; }

                if (!err && res.data?.members) {
                    const list = res.data.members;
                    if (!list.find(m => m.id === this.userId)) {
                        list.push({ id: this.userId, name: this.userName, online: true });
                    }
                    this.members = list;
                    console.log('[MEMBERS] Loaded:', this.members.length, 'online:', this.onlineCount);
                }
            } catch (error) { console.error('Load members failed:', error); }
        },
        async onMessage(data) {
            console.log('[RECV] onMessage called, type:', data.type, 'from:', data.fromName, 'content preview:', data.content?.substring(0, 50));
            if (data.content && data.type !== 'system') {
                try { 
                    if (data.type === 'image') {
                        // For images, content is a URL to encrypted file
                        // Download and decrypt it
                        data.decryptedContent = await this.downloadAndDecryptImage(data.content);
                        console.log('[RECV] Image decrypted successfully');
                    } else {
                        // For text, content is encrypted string
                        data.decryptedContent = await SecCrypto.decrypt(data.content, this.encryptionKey);
                        console.log('[RECV] Text decrypted:', data.decryptedContent);
                    }
                }
                catch (e) { 
                    console.error('Decryption failed for message:', data.id, e);
                    data.decryptedContent = data.type === 'image' ? '' : data.content; 
                }
            }
            this.messages.push(data);
            console.log('[RECV] Total messages now:', this.messages.length);
            this.$nextTick(() => this.scrollToBottom());
            if (data.from !== this.userId) SecWebSocket.sendRead(data.id);
        },
        async downloadAndDecryptImage(url) {
            // Download encrypted image from server
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to download image');
            
            const encryptedData = await response.arrayBuffer();
            
            // Decrypt the binary data
            const decryptedData = SecCrypto.decryptBinary(encryptedData, this.encryptionKey);
            
            // Convert to blob URL for display
            const blob = new Blob([decryptedData], { type: 'image/jpeg' });
            return URL.createObjectURL(blob);
        },
        async decryptMessage(msg) {
            // Helper to decrypt a message (text or image)
            if (!msg.content || msg.type === 'system') {
                msg.decryptedContent = msg.content;
                return;
            }
            try {
                if (msg.type === 'image') {
                    // Image content is a URL to encrypted file
                    msg.decryptedContent = await this.downloadAndDecryptImage(msg.content);
                } else {
                    // Text content is encrypted string
                    msg.decryptedContent = await SecCrypto.decrypt(msg.content, this.encryptionKey);
                }
            } catch (e) {
                console.error('Decrypt failed for msg:', msg.id, e);
                msg.decryptedContent = msg.type === 'image' ? '' : msg.content;
            }
        },
        onSystemMessage(data) {
            this.messages.push({ ...data, decryptedContent: data.content });
            this.$nextTick(() => this.scrollToBottom());
        },
        onTyping(data) {
            if (data.userId !== this.userId) {
                this.typingUser = data.userName;
                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => { this.typingUser = null; }, 3000);
            }
        },
        onRecall(data) {
            const msg = this.messages.find(m => m.id === data.id);
            if (msg) msg.recalled = true;
        },
        onUsers(data) { 
            if (data.users) {
                const list = data.users;
                if (!list.find(m => m.id === this.userId)) {
                    list.push({ id: this.userId, name: this.userName, online: true });
                }
                this.members = list;
            }
        },
        onDisconnected() { uni.showToast({ title: '连接已断开', icon: 'none' }); },
        async sendMessage() {
            const content = this.inputText.trim();
            if (!content) return;
            try {
                const encrypted = await SecCrypto.encrypt(content, this.encryptionKey);
                const options = {};
                if (this.replyingTo) options.replyTo = this.replyingTo.id;
                console.log('[SEND] Sending message:', content);
                SecWebSocket.sendMessage('text', encrypted, options);
                this.inputText = '';
                this.cancelReply();
            } catch (error) { 
                console.error('[SEND] Send failed:', error);
                uni.showToast({ title: '发送失败', icon: 'none' }); 
            }
        },
        async chooseImage() {
            console.log('[IMAGE] Starting chooseImage...');
            const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';

            if (isH5) {
                // H5: Use native file input for better compatibility with Puppeteer
                this.createAndTriggerFileInput();
            } else {
                // App/MiniProgram: Use uni.chooseImage
                const [err, res] = await uni.chooseImage({ count: 1, sizeType: ['compressed'] });
                console.log('[IMAGE] chooseImage result:', { err, res: res ? { tempFilePaths: res.tempFilePaths, tempFilesCount: res.tempFiles?.length } : null });
                if (!err && (res.tempFilePaths?.length > 0 || res.tempFiles?.length > 0)) {
                    await this.uploadImageFile(res.tempFilePaths[0], res.tempFiles?.[0]);
                }
            }
        },

        createAndTriggerFileInput() {
            console.log('[IMAGE] Creating file input...');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';

            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    console.log('[IMAGE] File selected:', file.name, file.size);
                    await this.uploadImageFile(file);
                }
                // Remove input after use
                document.body.removeChild(input);
            };

            document.body.appendChild(input);
            input.click();
        },

        async uploadImageFile(filePathOrBlob, tempFileBlob = null) {
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                console.log('[IMAGE] HTTP URL:', httpUrl);

                const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
                let arrayBuffer;

                if (isH5) {
                    // For H5
                    if (typeof filePathOrBlob === 'string') {
                        // Blob URL - fetch it
                        console.log('[IMAGE] Fetching blob URL:', filePathOrBlob);
                        const response = await fetch(filePathOrBlob);
                        arrayBuffer = await response.arrayBuffer();
                    } else if (filePathOrBlob instanceof File) {
                        // File object - read as ArrayBuffer
                        console.log('[IMAGE] Reading File object...');
                        arrayBuffer = await filePathOrBlob.arrayBuffer();
                    } else if (tempFileBlob instanceof Blob) {
                        console.log('[IMAGE] Reading Blob...');
                        arrayBuffer = await tempFileBlob.arrayBuffer();
                    }
                } else {
                    // For App/MiniProgram, use FileSystemManager
                    console.log('[IMAGE] Using FileSystemManager...');
                    const fs = uni.getFileSystemManager();
                    arrayBuffer = await new Promise((resolve, reject) => {
                        fs.readFile({
                            filePath: filePathOrBlob,
                            success: (fileRes) => resolve(fileRes.data),
                            fail: reject
                        });
                    });
                }

                console.log('[IMAGE] ArrayBuffer size:', arrayBuffer.byteLength);

                // Encrypt the binary data
                const encryptedData = SecCrypto.encryptBinary(arrayBuffer, this.encryptionKey);
                console.log('[IMAGE] Encrypted data size:', encryptedData.length);

                // Upload encrypted data to server
                const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
                const formData = new FormData();
                formData.append('file', blob, 'encrypted_image.bin');

                console.log('[IMAGE] Uploading to:', `${httpUrl}/api/upload`);
                const uploadRes = await fetch(`${httpUrl}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                console.log('[IMAGE] Upload response status:', uploadRes.status);
                if (!uploadRes.ok) {
                    const errorText = await uploadRes.text();
                    console.error('[IMAGE] Upload error:', errorText);
                    throw new Error('Upload failed: ' + errorText);
                }

                const uploadData = await uploadRes.json();
                console.log('[IMAGE] Upload response:', uploadData);
                const imageUrl = `${httpUrl}${uploadData.url}`;

                // Send image URL via WebSocket (URL is not encrypted, file content is)
                console.log('[SEND] Sending image URL:', imageUrl);
                SecWebSocket.sendMessage('image', imageUrl);

            } catch (e) {
                console.error('[IMAGE] Upload failed:', e);
                uni.showToast({ title: '图片上传失败', icon: 'none' });
            }
        },
        blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        },
        urlToBase64(url) {
            return new Promise((resolve, reject) => {
                // #ifdef H5
                // For H5, use fetch to handle blob URLs (uni.request cannot access blob: protocol)
                fetch(url)
                    .then(response => response.blob())
                    .then(blob => this.blobToBase64(blob))
                    .then(resolve)
                    .catch(reject);
                // #endif
                // #ifndef H5
                uni.request({
                    url: url,
                    responseType: 'arraybuffer',
                    success: (res) => {
                        const base64 = uni.arrayBufferToBase64(res.data);
                        resolve('data:image/jpeg;base64,' + base64);
                    },
                    fail: reject
                });
                // #endif
            });
        },
        previewImage(src) { uni.previewImage({ urls: [src] }); },
        insertEmoji(emoji) { this.inputText += emoji; this.showEmojiPicker = false; },
        showContextMenu(event, message) {
            this.contextMenu = { visible: true, x: event.touches[0].clientX, y: event.touches[0].clientY, message };
        },
        hideContextMenu() { this.contextMenu.visible = false; },
        handleContextAction(action) {
            const msg = this.contextMenu.message;
            if (!msg) return;
            if (action === 'copy') uni.setClipboardData({ data: msg.decryptedContent });
            else if (action === 'reply') this.replyingTo = msg;
            else if (action === 'recall' && msg.from === this.userId) SecWebSocket.sendRecall(msg.id);
            this.hideContextMenu();
        },
        cancelReply() { this.replyingTo = null; },
        getReplyPreview(id) {
            const msg = this.messages.find(m => m.id === id);
            return msg ? (msg.decryptedContent || '').substring(0, 30) : '消息已删除';
        },
        getAvatarChar(name) { return (name || '?').charAt(0).toUpperCase(); },
        shouldShowTime(index) {
            if (index === 0) return true;
            return (this.messages[index].timestamp - this.messages[index - 1].timestamp) > 300000;
        },
        formatTime(ts) { return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); },
        formatDate(ts) {
            const d = new Date(ts);
            const isToday = d.toDateString() === new Date().toDateString();
            return isToday ? '今天 ' + this.formatTime(ts) : d.toLocaleDateString('zh-CN') + ' ' + this.formatTime(ts);
        },
        isMessageSelf(msg) {
            // Match by ID OR by Name (for legacy/re-login compatibility)
            return msg.from === this.userId || msg.fromName === this.userName;
        },
        scrollToBottom() { if (this.messages.length) this.scrollToId = 'msg-' + this.messages[this.messages.length - 1].id; },
        goToMembers() { uni.navigateTo({ url: '/pages/members/members' }); },
        handleLogout() {
            uni.showModal({
                title: 'Tip',
                content: 'Are you sure you want to logout?',
                success: (res) => {
                    if (res.confirm) {
                        const app = getApp();
                        app.globalData.encryptionKey = null;
                        app.globalData.userId = '';
                        app.globalData.userName = '';
                        SecWebSocket.disconnect();
                        uni.reLaunch({ url: '/pages/login/login' });
                    }
                }
            });
        }
    },
    onUnload() {
        SecWebSocket.off('message', this.onMessage);
        SecWebSocket.off('system', this.onSystemMessage);
        SecWebSocket.off('typing', this.onTyping);
        SecWebSocket.off('recall', this.onRecall);
        SecWebSocket.off('users', this.onUsers);
        SecWebSocket.off('disconnected', this.onDisconnected);
    }
};
</script>

<style scoped>
.chat-page { display: flex; flex-direction: column; height: 100vh; background: #1e1e1e; overflow: hidden; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background: #2c2c2c; border-bottom: 1rpx solid #333; padding-top: calc(20rpx + var(--status-bar-height)); color: white; flex-shrink: 0; }
.header-title { font-size: 36rpx; font-weight: 600; }
.header-right { display: flex; align-items: center; }
.member-count { font-size: 24rpx; color: #888; margin-left: 16rpx; }
.icon-btn { padding: 16rpx; font-size: 36rpx; }
.loading-more { text-align: center; padding: 20rpx; font-size: 24rpx; color: #888; }
.messages-container { flex: 1; padding: 20rpx; overflow: auto; min-height: 0; }
.messages-list { display: flex; flex-direction: column; gap: 24rpx; }
.time-divider { text-align: center; font-size: 24rpx; color: #888; margin: 20rpx 0; }
.system-message { text-align: center; font-size: 24rpx; color: #888; background: rgba(0,0,0,0.05); padding: 12rpx 24rpx; border-radius: 24rpx; align-self: center; }
.message { display: flex; gap: 16rpx; max-width: 80%; }
.message.self { flex-direction: row-reverse; align-self: flex-end; }
.message-avatar { width: 80rpx; height: 80rpx; border-radius: 8rpx; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.message-avatar text { color: #fff; font-size: 32rpx; font-weight: 600; }
.message-content { display: flex; flex-direction: column; gap: 8rpx; }
.message-header { display: flex; align-items: center; gap: 16rpx; font-size: 24rpx; color: #888; }
.message.self .message-header { flex-direction: row-reverse; }
.message-bubble { padding: 20rpx 28rpx; border-radius: 16rpx; background: #fff; font-size: 30rpx; }
.message:not(.self) .message-bubble { border-top-left-radius: 0; }
.message.self .message-bubble { background: #95ec69; border-top-right-radius: 0; }
.message-bubble.image { padding: 8rpx; background: transparent; }
.message-bubble.image image { max-width: 400rpx; border-radius: 16rpx; }
.recalled-text { color: #888; font-style: italic; font-size: 26rpx; }
.message-reply { background: rgba(0,0,0,0.05); padding: 12rpx 20rpx; border-radius: 8rpx; border-left: 4rpx solid #07c160; font-size: 24rpx; color: #888; }
.typing-indicator { padding: 16rpx 30rpx; font-size: 26rpx; color: #888; }
.reply-preview { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 30rpx; background: #ededed; }
.reply-label { font-size: 26rpx; color: #07c160; }
.close-btn { font-size: 40rpx; color: #888; padding: 0 16rpx; }
.input-area { background: #2c2c2c; border-top: 1rpx solid #333; padding: 16rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); flex-shrink: 0; }
.input-toolbar { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.tool-btn { font-size: 40rpx; padding: 8rpx; }
.input-wrapper { display: flex; align-items: flex-end; gap: 16rpx; }
.message-input { flex: 1; padding: 20rpx 28rpx; border: 2rpx solid #444; border-radius: 40rpx; font-size: 30rpx; max-height: 200rpx; color: white; background: #3a3a3a; }
.send-btn { background: #ccc; color: #fff; padding: 20rpx 32rpx; border-radius: 40rpx; font-size: 28rpx; }
.send-btn.active { background: #07c160; }
.emoji-picker { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 20rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); z-index: 100; }
.emoji-grid { display: flex; flex-wrap: wrap; gap: 8rpx; }
.emoji-item { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; font-size: 40rpx; }
.emoji-close { text-align: center; padding: 20rpx; color: #07c160; }
.context-menu { position: fixed; background: #fff; border-radius: 16rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.15); z-index: 200; overflow: hidden; }
.menu-item { padding: 24rpx 40rpx; font-size: 28rpx; border-bottom: 1rpx solid #f0f0f0; }
.context-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 199; }
</style>
