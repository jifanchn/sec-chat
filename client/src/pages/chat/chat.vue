<template>
    <view class="chat-page">
        <view class="chat-header">
            <view class="header-left">
                <text class="header-title">SecChat</text>
                <text class="member-count">{{ onlineCount }}人在线</text>
            </view>
            <view class="header-right">
                <view class="icon-btn" @click="goToMembers">👥</view>
            </view>
        </view>
        
        <scroll-view class="messages-container" scroll-y :scroll-top="scrollTop" :scroll-into-view="scrollToId" @scrolltoupper="loadMore">
            <view class="messages-list">
                <view v-if="hasMore" class="loading-more">
                    <text>正在加载更多消息...</text>
                </view>
                <view v-for="(msg, index) in messages" :key="msg.id" :id="'msg-' + msg.id">
                    <view v-if="shouldShowTime(index)" class="time-divider">
                        <text>{{ formatDate(msg.timestamp) }}</text>
                    </view>
                    
                    <view v-if="msg.type === 'system'" class="system-message">
                        <text>{{ msg.content }}</text>
                    </view>
                    
                    <view v-else class="message" :class="{ self: msg.from === userId }" @longpress="showContextMenu($event, msg)">
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
                <textarea class="message-input" v-model="inputText" placeholder="输入消息..." :auto-height="true" @confirm="sendMessage"/>
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
    },
    methods: {
        async loadHistory() {
            if (this.isLoading) return;
            this.isLoading = true;
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                const [err, res] = await uni.request({ url: `${httpUrl}/api/messages?limit=50`, method: 'GET' });
                if (!err && res.data?.messages) {
                    const newMessages = res.data.messages;
                    for (const msg of newMessages) {
                        if (msg.content && msg.type !== 'system') {
                            try { msg.decryptedContent = await SecCrypto.decrypt(msg.content, this.encryptionKey); }
                            catch (e) { msg.decryptedContent = msg.content; }
                        } else { msg.decryptedContent = msg.content; }
                    }
                    this.messages = newMessages;
                    this.hasMore = res.data.hasMore;
                    this.$nextTick(() => this.scrollToBottom());
                }
            } catch (error) { console.error('Load history failed:', error); }
            finally { this.isLoading = false; }
        },
        async loadMore() {
            if (this.isLoading || !this.hasMore || this.messages.length === 0) return;
            this.isLoading = true;
            try {
                const app = getApp();
                const firstMsg = this.messages[0];
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                const [err, res] = await uni.request({ url: `${httpUrl}/api/messages?limit=50&before=${firstMsg.timestamp}`, method: 'GET' });
                if (!err && res.data?.messages) {
                    const olderMessages = res.data.messages;
                    for (const msg of olderMessages) {
                        if (msg.content && msg.type !== 'system') {
                            try { msg.decryptedContent = await SecCrypto.decrypt(msg.content, this.encryptionKey); }
                            catch (e) { msg.decryptedContent = msg.content; }
                        } else { msg.decryptedContent = msg.content; }
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
        async onMessage(data) {
            if (data.content && data.type !== 'system') {
                try { data.decryptedContent = await SecCrypto.decrypt(data.content, this.encryptionKey); }
                catch (e) { data.decryptedContent = data.content; }
            }
            this.messages.push(data);
            this.$nextTick(() => this.scrollToBottom());
            if (data.from !== this.userId) SecWebSocket.sendRead(data.id);
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
        onUsers(data) { if (data.users) this.members = data.users; },
        onDisconnected() { uni.showToast({ title: '连接已断开', icon: 'none' }); },
        async sendMessage() {
            const content = this.inputText.trim();
            if (!content) return;
            try {
                const encrypted = await SecCrypto.encrypt(content, this.encryptionKey);
                const options = {};
                if (this.replyingTo) options.replyTo = this.replyingTo.id;
                SecWebSocket.sendMessage('text', encrypted, options);
                this.inputText = '';
                this.cancelReply();
            } catch (error) { uni.showToast({ title: '发送失败', icon: 'none' }); }
        },
        async chooseImage() {
            const [err, res] = await uni.chooseImage({ count: 1, sizeType: ['compressed'] });
            if (!err && res.tempFilePaths?.length > 0) {
                const fs = uni.getFileSystemManager();
                fs.readFile({
                    filePath: res.tempFilePaths[0], encoding: 'base64',
                    success: async (fileRes) => {
                        const base64 = 'data:image/jpeg;base64,' + fileRes.data;
                        const encrypted = await SecCrypto.encrypt(base64, this.encryptionKey);
                        SecWebSocket.sendMessage('image', encrypted);
                    }
                });
            }
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
        scrollToBottom() { if (this.messages.length) this.scrollToId = 'msg-' + this.messages[this.messages.length - 1].id; },
        goToMembers() { uni.navigateTo({ url: '/pages/members/members' }); }
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
.chat-page { display: flex; flex-direction: column; height: 100vh; background: #f5f5f5; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background: #fff; border-bottom: 1rpx solid #e5e5e5; padding-top: calc(20rpx + var(--status-bar-height)); }
.header-title { font-size: 36rpx; font-weight: 600; }
.member-count { font-size: 24rpx; color: #888; margin-left: 16rpx; }
.icon-btn { padding: 16rpx; font-size: 36rpx; }
.loading-more { text-align: center; padding: 20rpx; font-size: 24rpx; color: #888; }
.messages-container { flex: 1; padding: 20rpx; }
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
.input-area { background: #fff; border-top: 1rpx solid #e5e5e5; padding: 16rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); }
.input-toolbar { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.tool-btn { font-size: 40rpx; padding: 8rpx; }
.input-wrapper { display: flex; align-items: flex-end; gap: 16rpx; }
.message-input { flex: 1; padding: 20rpx 28rpx; border: 2rpx solid #e5e5e5; border-radius: 40rpx; font-size: 30rpx; max-height: 200rpx; }
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
