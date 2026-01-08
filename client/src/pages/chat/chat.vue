<template>
    <view class="chat-page">
        <view class="chat-header">
        <view class="header-left" @click="goToMembers">
                <image class="header-logo" src="/static/secchat_logo.png" mode="aspectFit" />
                <view class="header-title-group">
                    <text class="header-title">SecChat</text>
                    <text class="member-count">{{ onlineCount }}人在线</text>
                </view>
            </view>
            <view class="header-right">
                <view class="icon-btn" @click="changeAvatar" style="margin-right: 15rpx; overflow: hidden; border-radius: 50%; width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center; background: #e0e0e0; padding: 0;">
                    <image v-if="currentUserAvatar" :src="currentUserAvatar" mode="aspectFill" style="width: 100%; height: 100%;" />
                    <text v-else style="font-size: 30rpx;">{{ getAvatarChar(userName) }}</text>
                </view>
                <view class="icon-btn icon-btn-svg" @click="goToMembers">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="9" cy="7" r="4" stroke="url(#members-grad)" stroke-width="2"/>
                        <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" stroke="url(#members-grad)" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="19" cy="7" r="3" stroke="url(#members-grad)" stroke-width="2" opacity="0.6"/>
                        <path d="M19 15a3 3 0 0 1 3 3v2" stroke="url(#members-grad)" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
                        <defs>
                            <linearGradient id="members-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#38B2AC"/>
                                <stop offset="100%" stop-color="#4FD1C5"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </view>
                <view class="icon-btn icon-btn-svg" @click="handleLogout" style="margin-left: 10rpx;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="url(#logout-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="16,17 21,12 16,7" stroke="url(#logout-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <line x1="21" y1="12" x2="9" y2="12" stroke="url(#logout-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <defs>
                            <linearGradient id="logout-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#F6AD55"/>
                                <stop offset="100%" stop-color="#FC8181"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </view>
            </view>
        </view>
        
        <view v-if="connectionState === 'reconnecting'" class="connection-status warning">
            <text>连接中断，正在重连...</text>
        </view>
        <view v-else-if="connectionState === 'disconnected'" class="connection-status error">
            <text>连接已断开，请检查网络</text>
        </view>
        
        <scroll-view class="messages-container" scroll-y :scroll-into-view="scrollToId" @scrolltoupper="loadMore" @scroll="onScroll">
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
                    
                    <view v-else class="message" :class="{ self: isMessageSelf(msg), pending: msg.pending, failed: msg.failed }" @longpress="showContextMenu($event, msg)">
                        <view class="message-avatar">
                        <image v-if="getAvatarUrl(msg.from, msg.fromName)" :src="getAvatarUrl(msg.from, msg.fromName)" mode="aspectFill" class="avatar-image"/>
                        <text v-else>{{ getAvatarChar(msg.fromName) }}</text>
                    </view>
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
                            <!-- Message status indicator -->
                            <view v-if="msg.pending" class="message-status pending">
                                <text>发送中...</text>
                            </view>
                            <view v-else-if="msg.failed" class="message-status failed" @click="retryMessage(msg)">
                                <text>发送失败 ⟳</text>
                            </view>
                            <view v-else-if="msg.delivered" class="message-status delivered">
                                <text>✓ 已送达</text>
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
            <view class="input-wrapper">
                <view class="input-toolbar">
                    <view class="tool-btn" @click="showEmojiPicker = true">😊</view>
                    <view class="tool-btn" @click="chooseImage">📷</view>
                </view>
                
                <view v-if="showMentionPicker" class="mention-picker">
                    <view v-for="member in filteredMembers" :key="member.id" class="mention-item" @click="selectMention(member)">
                        <view class="mention-avatar">
                             <image v-if="member.avatar" :src="member.avatar" mode="aspectFill" />
                             <text v-else>{{ getAvatarChar(member.name) }}</text>
                        </view>
                        <text class="mention-name">{{ member.name }}</text>
                    </view>
                </view>
                
                <textarea class="message-input" v-model="inputText" placeholder="输入消息..." maxlength="-1" @confirm="sendMessage" @keydown.enter.exact.prevent="sendMessage" @focus="onInputFocus"/>
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
            <view v-if="!contextMenu.message?.recalled" class="menu-item" @click="handleContextAction('reply')">回复</view>
            <view v-if="isSameUser(contextMenu.message?.fromName, userName) && !contextMenu.message?.recalled" class="menu-item" @click="handleContextAction('recall')">撤回</view>
        </view>
        <view v-if="contextMenu.visible" class="context-overlay" @click="hideContextMenu"></view>

        <!-- Use a custom modal for logout -->
        <view v-if="showLogoutModal" class="modal-overlay">
            <view class="modal-content">
                <view class="modal-header">
                    <text class="modal-title">提示</text>
                </view>
                <view class="modal-body">
                    <text class="modal-text">确定要退出登录吗？</text>
                </view>
                <view class="modal-footer">
                    <view class="modal-btn cancel" @click="showLogoutModal = false">取消</view>
                    <view class="modal-btn confirm" @click="confirmLogout">确定</view>
                </view>
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
            userId: '', userName: '', encryptionKey: null,
            messages: [], members: [],
            inputText: '', scrollTop: 0, scrollToId: '',
            replyingTo: null, typingUser: null, typingTimeout: null, lastTypingSent: 0,
            showEmojiPicker: false, isLoading: false, hasMore: true,
            showMentionPicker: false, mentionSearchKeyword: '',
            contextMenu: { visible: false, x: 0, y: 0, message: null },
            emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😍','🥰','😘','👍','👎','👎','👌','❤️','💔','🎉'],
            connectionState: 'connected', // connected, reconnecting, disconnected
            isAtBottom: true,
            containerHeight: 0,
            scrollTimeout: null,
            showLogoutModal: false,
            localAvatarUrl: '' // Add local state for immediate avatar update
        };
    },
    watch: {
        inputText(val) {
            const match = val.match(/@([^@\s]*)$/);
            if (match) {
                this.showMentionPicker = true;
                this.mentionSearchKeyword = match[1];
            } else {
                this.showMentionPicker = false;
                this.mentionSearchKeyword = '';
            }
        }
    },
    computed: {
        onlineCount() { return this.members.filter(m => m.online).length; },
        filteredMembers() {
            let users = this.members;
            // Filter out users that should be excluded (placeholder for now)
            users = users.filter(u => this.isUserMentionable(u));
            
            if (!this.mentionSearchKeyword) return users;
            const kw = this.mentionSearchKeyword.toLowerCase();
            return users.filter(m => m.name.toLowerCase().includes(kw));
        },
        currentUserAvatar() {
            // Priority: Local state > Global Data > Members list
            if (this.localAvatarUrl) return this.localAvatarUrl;
            const app = getApp();
            if (app?.globalData?.avatarUrl) return app.globalData.avatarUrl;
            const me = this.members.find(m => m.id === this.userId);
            return me ? me.avatar : '';
        }
    },
    onLoad() {
        const app = getApp();
        this.userId = app.globalData.userId;
        this.userName = app.globalData.userName;
        this.encryptionKey = app.globalData.encryptionKey;
        this.localAvatarUrl = app.globalData.avatarUrl || '';
        this.messages = [];
        
        SecWebSocket.on('message', this.onMessage);
        SecWebSocket.on('system', this.onSystemMessage);
        SecWebSocket.on('typing', this.onTyping);
        SecWebSocket.on('recall', this.onRecall);
        SecWebSocket.on('users', this.onUsers);
        SecWebSocket.on('reconnecting', this.onReconnecting);
        SecWebSocket.on('connected', this.onConnected);
        SecWebSocket.on('disconnected', this.onDisconnected);
        
        // Register clipboard paste listener for H5
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            document.addEventListener('paste', this.handlePaste);
        }
        
        this.loadHistory();
        this.loadMembers();  // Load members on init
    },
    onReady() {
        this.updateContainerHeight();
    },
    methods: {
        updateContainerHeight() {
            const query = uni.createSelectorQuery().in(this);
            query.select('.messages-container').boundingClientRect(data => {
                if (data) {
                    this.containerHeight = data.height;
                }
            }).exec();
        },
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
                    // Retain pending/failed messages that are seemingly not in history yet
                    const pendingMsgs = this.messages.filter(m => m.pending || m.failed);
                    this.mergeMessages([...newMessages, ...pendingMsgs]);
                    this.hasMore = res.data.hasMore;
                    this.hasMore = res.data.hasMore;
                    this.$nextTick(() => {
                        this.scrollToBottom(true);
                        // Double check scroll after a short delay to account for rendering
                        setTimeout(() => this.scrollToBottom(true), 100);
                    });
                } else {
                    console.error('Load history response error:', err, res);
                }
            } catch (error) { 
                console.error('Load history exception:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
            finally { this.isLoading = false; }
        },
        // Helper to safely merge messages without duplicates and sort by time
        mergeMessages(newMsgs) {
            const currentMap = new Map(this.messages.map(m => [m.id, m]));
            let changed = false;
            
            newMsgs.forEach(msg => {
                if (currentMap.has(msg.id)) {
                    // Update existing message (e.g. status change)
                    const existing = currentMap.get(msg.id);
                    // Only update if properties changed (simplify check)
                    Object.assign(existing, msg);
                } else {
                    currentMap.set(msg.id, msg);
                    changed = true;
                }
            });
            
            // Convert back to array and sort
            this.messages = Array.from(currentMap.values()).sort((a, b) => a.timestamp - b.timestamp);
            return changed;
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
                        this.mergeMessages(olderMessages);
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
                    
                    // Update current user's avatar from server data if available
                    const me = list.find(m => m.id === this.userId);
                    if (me && me.avatar) {
                        app.globalData.avatarUrl = me.avatar;
                        this.localAvatarUrl = me.avatar;
                        // Update WebSocket auth credentials for reconnection
                        if (window.SecWebSocketInstance && window.SecWebSocketInstance.authCredentials) {
                            window.SecWebSocketInstance.authCredentials.avatar = me.avatar;
                        }
                    }
                    
                    if (!list.find(m => m.id === this.userId)) {
                        list.push({ id: this.userId, name: this.userName, online: true, avatar: app.globalData.avatarUrl });
                    }
                    this.members = list;
                    console.log('[MEMBERS] Loaded:', this.members.length, 'online:', this.onlineCount);
                }
            } catch (error) { console.error('Load members failed:', error); }
        },
        async onMessage(data) {
            console.log('[RECV] onMessage called, type:', data.type, 'from:', data.fromName, 'id:', data.id);
            
            // Skip self check - we now handle deduplication in mergeMessages
            // if (data.from === this.userId) { ... }
            
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
            this.mergeMessages([data]);
            console.log('[RECV] Total messages now:', this.messages.length);
            this.$nextTick(() => {
                // Username match is our source of truth for "self"
                if (this.isAtBottom || this.isSameUser(data.fromName, this.userName)) {
                    this.scrollToBottom();
                }
            });
            SecWebSocket.sendRead(data.id);
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
            // Treat same-name user as "self" for UI purposes
            if (!this.isSameUser(data.userName, this.userName)) {
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
                const app = getApp();
                const list = data.users;
                
                // Update current user's avatar from server data if available
                const me = list.find(m => m.id === this.userId);
                if (me && me.avatar) {
                    app.globalData.avatarUrl = me.avatar;
                    this.localAvatarUrl = me.avatar;
                    // Update WebSocket auth credentials for reconnection
                    if (window.SecWebSocketInstance && window.SecWebSocketInstance.authCredentials) {
                        window.SecWebSocketInstance.authCredentials.avatar = me.avatar;
                    }
                }
                
                if (!list.find(m => m.id === this.userId)) {
                    list.push({ id: this.userId, name: this.userName, online: true, avatar: app.globalData.avatarUrl });
                }
                this.members = list;
            }
        },
        onDisconnected() { 
            this.connectionState = 'disconnected';
            uni.showToast({ title: '连接已断开', icon: 'none' }); 
        },
        onReconnecting() {
            this.connectionState = 'reconnecting';
            console.log('App showing reconnecting state');
        },
        onConnected() {
            this.connectionState = 'connected';
            console.log('App connected');
            // Re-fetch messages or sync state if needed
            this.loadHistory();
        },
        onScroll(e) {
            // Check if user is at bottom
            const { scrollTop, scrollHeight } = e.detail;
            
            // If container height is unknown or likely changed, update it
            if (!this.containerHeight) {
                this.updateContainerHeight();
            }
            
            if (this.containerHeight) {
                // If the gap between content bottom and view bottom is small (< 100px)
                const distanceToBottom = scrollHeight - scrollTop - this.containerHeight;
                this.isAtBottom = distanceToBottom < 100;
            }
        },
        onInputFocus() {
            if (this.isAtBottom) {
                // If at bottom, maintain bottom position after keyboard opens
                setTimeout(() => {
                    this.scrollToBottom(true);
                    this.updateContainerHeight();
                }, 300); 
            } else {
                 // If not at bottom, just update height for future calculations
                 setTimeout(() => this.updateContainerHeight(), 300);
            }
        },
        async sendMessage() {
            const content = this.inputText.trim();
            if (!content) return;
            
            // Generate local ID for optimistic UI
            const localId = 'local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            const timestamp = Date.now();
            
            try {
                const encrypted = await SecCrypto.encrypt(content, this.encryptionKey);
                const options = {};
                if (this.replyingTo) options.replyTo = this.replyingTo.id;

                // Parse mentions
                const mentionRegex = /@([^@\s]+)/g;
                const matches = content.match(mentionRegex);
                if (matches) {
                    const mentions = [];
                    matches.forEach(m => {
                        const name = m.substring(1);
                        const user = this.members.find(u => u.name === name);
                        if (user) mentions.push(user.id);
                    });
                    if (mentions.length > 0) {
                        options.mentions = [...new Set(mentions)];
                    }
                }
                
                // Optimistic UI: Show message immediately with pending status
                const pendingMsg = {
                    id: localId,
                    type: 'text',
                    from: this.userId,
                    fromName: this.userName,
                    content: encrypted,
                    decryptedContent: content,
                    timestamp: timestamp,
                    replyTo: options.replyTo,
                    mentions: options.mentions,
                    pending: true,  // Mark as pending
                    failed: false
                };
                this.messages.push(pendingMsg);
                this.$nextTick(() => this.scrollToBottom(true));
                
                this.inputText = '';
                this.cancelReply();
                
                console.log('[SEND] Sending message:', content);
                
                // Send via WebSocket and wait for confirmation
                try {
                    // Pass localId to ensure consistency
                    const result = await SecWebSocket.sendMessage('text', encrypted, { ...options, id: localId });
                    // Message delivered - update the pending message with server ID
                    const idx = this.messages.findIndex(m => m.id === localId);
                    if (idx !== -1) {
                         // ID should match since we passed it, but checking just in case
                        if (this.messages[idx].id !== result.id) {
                            console.warn('[SEND] ID mismatch:', this.messages[idx].id, result.id);
                            this.messages[idx].id = result.id;
                        }
                        this.messages[idx].pending = false;
                        this.messages[idx].delivered = true;  // Mark as delivered by server
                        console.log('[SEND] Message delivered, id:', result.id);
                    }
                } catch (sendError) {
                    // Delivery failed - mark as failed
                    console.error('[SEND] Delivery failed:', sendError);
                    const idx = this.messages.findIndex(m => m.id === localId);
                    if (idx !== -1) {
                        this.messages[idx].pending = false;
                        this.messages[idx].failed = true;
                    }
                    uni.showToast({ title: '发送失败，点击重试', icon: 'none' });
                }
            } catch (error) { 
                console.error('[SEND] Encryption failed:', error);
                uni.showToast({ title: '加密失败', icon: 'none' }); 
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
        
        // Handle clipboard paste event for images
        handlePaste(event) {
            console.log('[PASTE] Paste event triggered');
            const items = event.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    console.log('[PASTE] Image found in clipboard, type:', item.type);
                    event.preventDefault();
                    
                    const file = item.getAsFile();
                    if (file) {
                        console.log('[PASTE] Image file:', file.name || 'clipboard-image', file.size);
                        this.uploadImageFile(file);
                    }
                    break; // Only handle the first image
                }
            }
        },

        async uploadImageFile(filePathOrBlob, tempFileBlob = null) {
            // Generate local ID for optimistic UI
            const localId = 'local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            const timestamp = Date.now();
            
            // Create a preview URL for immediate display
            let previewUrl = '';
            const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
            
            if (isH5) {
                if (filePathOrBlob instanceof File || filePathOrBlob instanceof Blob) {
                    previewUrl = URL.createObjectURL(filePathOrBlob);
                } else if (typeof filePathOrBlob === 'string') {
                    previewUrl = filePathOrBlob;
                }
            }
            
            // Optimistic UI: Show image message immediately with pending status
            const pendingMsg = {
                id: localId,
                type: 'image',
                from: this.userId,
                fromName: this.userName,
                content: '',
                decryptedContent: previewUrl,  // Show preview immediately
                timestamp: timestamp,
                pending: true,
                failed: false
            };
            this.messages.push(pendingMsg);
            this.$nextTick(() => this.scrollToBottom(true));
            
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                console.log('[IMAGE] HTTP URL:', httpUrl);

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

                // Send image URL via WebSocket and wait for confirmation
                console.log('[SEND] Sending image URL:', imageUrl);
                try {
                    // Pass localId for consistency
                    const result = await SecWebSocket.sendMessage('image', imageUrl, { id: localId });
                    // Message delivered - update the pending message
                    const idx = this.messages.findIndex(m => m.id === localId);
                    if (idx !== -1) {
                        if (this.messages[idx].id !== result.id) {
                             this.messages[idx].id = result.id;
                        }
                        this.messages[idx].pending = false;
                        this.messages[idx].delivered = true;  // Mark as delivered by server
                        this.messages[idx].content = imageUrl;
                        console.log('[SEND] Image message delivered, id:', result.id);
                    }
                } catch (sendError) {
                    // Delivery failed - mark as failed
                    console.error('[SEND] Image delivery failed:', sendError);
                    const idx = this.messages.findIndex(m => m.id === localId);
                    if (idx !== -1) {
                        this.messages[idx].pending = false;
                        this.messages[idx].failed = true;
                    }
                    uni.showToast({ title: '图片发送失败，点击重试', icon: 'none' });
                }

            } catch (e) {
                console.error('[IMAGE] Upload failed:', e);
                // Mark as failed in UI
                const idx = this.messages.findIndex(m => m.id === localId);
                if (idx !== -1) {
                    this.messages[idx].pending = false;
                    this.messages[idx].failed = true;
                }
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
        isUserMentionable(user) {
            // Logic to exclude certain users can be added here
            // For example: return user.id !== this.userId; // Uncomment to exclude self
            return true;
        },
        selectMention(user) {
            const match = this.inputText.match(/@([^@\s]*)$/);
            if (match) {
                const prefix = this.inputText.substring(0, match.index);
                this.inputText = prefix + `@${user.name} `;
                this.showMentionPicker = false;
                this.mentionSearchKeyword = '';
            }
        },
        showContextMenu(event, message) {
            this.contextMenu = { visible: true, x: event.touches[0].clientX, y: event.touches[0].clientY, message };
        },
        hideContextMenu() { this.contextMenu.visible = false; },
        handleContextAction(action) {
            const msg = this.contextMenu.message;
            if (!msg) return;
            if (action === 'copy') uni.setClipboardData({ data: msg.decryptedContent });
            else if (action === 'reply') this.replyingTo = msg;
            else if (action === 'recall' && this.isSameUser(msg.fromName, this.userName)) SecWebSocket.sendRecall(msg.id);
            this.hideContextMenu();
        },
        async retryMessage(msg) {
            if (!msg.failed) return;
            
            // Remove failed message
            const idx = this.messages.findIndex(m => m.id === msg.id);
            if (idx !== -1) {
                this.messages.splice(idx, 1);
            }
            
            // Re-send the message
            const content = msg.decryptedContent;
            if (content) {
                this.inputText = content;
                await this.sendMessage();
            }
        },
        cancelReply() { this.replyingTo = null; },
        getReplyPreview(id) {
            const msg = this.messages.find(m => m.id === id);
            if (!msg) return '消息已删除';
            if (msg.recalled) return '消息已撤回';
            return (msg.decryptedContent || '').substring(0, 30);
        },
        getAvatarChar(name) { return (name || '?').charAt(0).toUpperCase(); },
        isSameUser(fromName, currentName) {
            const a = (fromName || '').trim();
            const b = (currentName || '').trim();
            return !!a && !!b && a === b;
        },
        getAvatarUrl(userId, fromName = '') {
            const app = getApp();
            // Primary rule: username match => same person
            if (this.isSameUser(fromName, app?.globalData?.userName || this.userName)) {
                // Use reactive localAvatarUrl for proper view updates
                return this.localAvatarUrl || app.globalData.avatarUrl || '';
            }
            const user = this.members.find(m => m.id === userId);
            return user ? user.avatar : '';
        },
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
        async changeAvatar() {
            console.log('[AVATAR] changing avatar...');
            const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
            
            if (isH5) {
                // H5: Use native file input
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';
                input.onchange = async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        await this.uploadAndSetAvatar(file);
                    }
                    document.body.removeChild(input);
                };
                document.body.appendChild(input);
                input.click();
            } else {
                // App/MiniProgram
                const [err, res] = await uni.chooseImage({ count: 1, sizeType: ['compressed'] });
                if (!err && res.tempFilePaths?.length > 0) {
                    await this.uploadAndSetAvatar(res.tempFilePaths[0], res.tempFiles?.[0]);
                }
            }
        },
        async uploadAndSetAvatar(filePathOrBlob, tempFileBlob = null) {
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                
                // 1. Upload the image first (reuse backend upload logic)
                const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
                let blob;

                if (isH5) {
                    if (filePathOrBlob instanceof File || filePathOrBlob instanceof Blob) {
                        blob = filePathOrBlob;
                    } else if (typeof filePathOrBlob === 'string') {
                         const response = await fetch(filePathOrBlob);
                         blob = await response.blob();
                    }
                } else {
                    // Not fully implemented for non-H5 yet for brevity, but re-using logic
                    // For now focus on H5 as requested implicitly by context
                    uni.showToast({ title: '暂不支持非H5更换头像', icon: 'none' });
                    return;
                }

                if (!blob) return;

                const formData = new FormData();
                formData.append('file', blob, 'avatar.jpg');

                const uploadRes = await fetch(`${httpUrl}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!uploadRes.ok) throw new Error('Upload failed');
                const uploadData = await uploadRes.json();
                const avatarUrl = `${httpUrl}${uploadData.url}`;

                // 2. Call set avatar endpoint
                const updateRes = await fetch(`${httpUrl}/api/user/avatar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.userId,
                        avatar: avatarUrl
                    })
                });

                if (!updateRes.ok) throw new Error('Update failed');
                
                // Update local state and global data
                app.globalData.avatarUrl = avatarUrl;
                this.localAvatarUrl = avatarUrl; // Update local state for reactivity
                
                // Update WebSocket auth credentials for reconnection
                if (window.SecWebSocketInstance && window.SecWebSocketInstance.authCredentials) {
                    window.SecWebSocketInstance.authCredentials.avatar = avatarUrl;
                }
                
                // Update members list with new avatar to ensure message avatars update
                const meIndex = this.members.findIndex(m => m.id === this.userId);
                if (meIndex !== -1) {
                    // Use Vue.set pattern for reactivity
                    this.members[meIndex] = { ...this.members[meIndex], avatar: avatarUrl };
                    // Force Vue to detect the array change
                    this.members = [...this.members];
                }
                
                // Force view update to refresh message avatars
                this.$forceUpdate();
                
                uni.showToast({ title: '头像更新成功', icon: 'none' });

            } catch (e) {
                console.error('[AVATAR] Failed to update:', e);
                uni.showToast({ title: '更新失败', icon: 'none' });
            }
        },
        isMessageSelf(msg) {
            // Username match is the source of truth
            return this.isSameUser(msg?.fromName, this.userName);
        },
        scrollToBottom(force = false) { 
            if (this.messages.length) {
                this.scrollToId = '';
                this.$nextTick(() => {
                    this.scrollToId = 'msg-' + this.messages[this.messages.length - 1].id;
                    this.isAtBottom = true; 
                });
            }
        },
        goToMembers() { uni.navigateTo({ url: '/pages/members/members' }); },
        handleLogout() {
            this.showLogoutModal = true;
        },
        confirmLogout() {
            this.showLogoutModal = false;
            const app = getApp();
            app.globalData.encryptionKey = null;
            app.globalData.userId = '';
            app.globalData.userName = '';
            SecWebSocket.disconnect();
            uni.reLaunch({ url: '/pages/login/login' });
        }
    },
    onUnload() {
        SecWebSocket.off('message', this.onMessage);
        SecWebSocket.off('system', this.onSystemMessage);
        SecWebSocket.off('typing', this.onTyping);
        SecWebSocket.off('recall', this.onRecall);
        SecWebSocket.off('users', this.onUsers);
        SecWebSocket.off('disconnected', this.onDisconnected);
        SecWebSocket.off('reconnecting', this.onReconnecting);
        SecWebSocket.off('connected', this.onConnected);
        
        // Remove clipboard paste listener
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            document.removeEventListener('paste', this.handlePaste);
        }
    }
};
</script>

<style scoped>
.chat-page { display: flex; flex-direction: column; height: 100vh; background: #1e1e1e; overflow: hidden; }
.connection-status { padding: 10rpx; text-align: center; font-size: 24rpx; color: white; }
.connection-status.warning { background: #e6a23c; }
.connection-status.error { background: #f56c6c; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background: linear-gradient(135deg, #2c2c2c 0%, #1a1a2e 100%); border-bottom: 1rpx solid #333; padding-top: calc(20rpx + var(--status-bar-height)); color: white; flex-shrink: 0; }
.header-left { display: flex; align-items: center; gap: 16rpx; }
.header-logo { width: 72rpx; height: 72rpx; border-radius: 12rpx; flex-shrink: 0; }
.header-title-group { display: flex; flex-direction: column; gap: 4rpx; }
.header-title { font-size: 36rpx; font-weight: 600; background: linear-gradient(135deg, #a78bfa, #60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.header-right { display: flex; align-items: center; }
.member-count { font-size: 22rpx; color: #888; }
.icon-btn { padding: 16rpx; font-size: 36rpx; }
.icon-btn-svg { padding: 12rpx; background: rgba(255,255,255,0.08); border-radius: 12rpx; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
.icon-btn-svg:active { background: rgba(255,255,255,0.15); transform: scale(0.95); }
.svg-icon { width: 40rpx; height: 40rpx; display: block; }
.loading-more { text-align: center; padding: 20rpx; font-size: 24rpx; color: #888; }
.messages-container { flex: 1; padding: 20rpx 20rpx 20rpx 20rpx; overflow: auto; min-height: 0; box-sizing: border-box; }
.messages-container::-webkit-scrollbar { display: none; width: 0; height: 0; color: transparent; }
.messages-list { display: flex; flex-direction: column; gap: 24rpx; }
.time-divider { text-align: center; font-size: 24rpx; color: #888; margin: 20rpx 0; }
.system-message { text-align: center; font-size: 24rpx; color: #888; background: rgba(0,0,0,0.05); padding: 12rpx 24rpx; border-radius: 24rpx; align-self: center; }
.message { display: flex; gap: 16rpx; max-width: 80%; margin-left: 0; margin-right: auto; }
.message.self { flex-direction: row-reverse; align-self: flex-end; margin-left: auto; margin-right: 0; }
.message-avatar { width: 80rpx; height: 80rpx; border-radius: 8rpx; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.message-avatar text { color: #fff; font-size: 32rpx; font-weight: 600; }
.avatar-image { width: 100%; height: 100%; }
.message-content { display: flex; flex-direction: column; gap: 8rpx; align-items: flex-start; }
.message.self .message-content { align-items: flex-end; }
.message-header { display: flex; align-items: center; gap: 16rpx; font-size: 24rpx; color: #888; }
.message.self .message-header { flex-direction: row-reverse; }
.message-bubble { padding: 20rpx 28rpx; border-radius: 16rpx; background: #95ec69; font-size: 30rpx; color: #000; word-break: break-all; }
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
.input-toolbar { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; }
.tool-btn { font-size: 40rpx; padding: 8rpx; line-height: 1; }
.input-wrapper { display: flex; align-items: center; gap: 12rpx; position: relative; flex-wrap: nowrap; }
.message-input { flex: 1; min-width: 0; padding: 16rpx 24rpx; border: 2rpx solid #444; border-radius: 40rpx; font-size: 30rpx; height: 72rpx; color: white; background: #3a3a3a; overflow-y: auto; resize: none; line-height: 1.4; box-sizing: border-box; }
.send-btn { background: #ccc; color: #fff; padding: 16rpx 28rpx; border-radius: 40rpx; font-size: 28rpx; flex-shrink: 0; white-space: nowrap; }
.mention-picker {
    position: absolute;
    bottom: 110%;
    left: 0;
    width: 60%;
    background: #2c2c2c;
    border: 1px solid #444;
    border-radius: 12rpx;
    max-height: 400rpx;
    overflow-y: auto;
    z-index: 500;
    box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.3);
}
.mention-item {
    display: flex;
    align-items: center;
    padding: 20rpx;
    border-bottom: 1px solid #333;
}
.mention-item:active { background: #444; }
.mention-avatar { width: 50rpx; height: 50rpx; border-radius: 50%; margin-right: 20rpx; background: #555; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.mention-avatar text { font-size: 24rpx; color: #fff; }
.mention-avatar image { width: 100%; height: 100%; }
.mention-name { font-size: 28rpx; color: #eee; }
.send-btn.active { background: #07c160; }
.emoji-picker { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 20rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); z-index: 100; }
.emoji-grid { display: flex; flex-wrap: wrap; gap: 8rpx; }
.emoji-item { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; font-size: 40rpx; }
.emoji-close { text-align: center; padding: 20rpx; color: #07c160; }
.context-menu { position: fixed; background: #fff; border-radius: 16rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.15); z-index: 200; overflow: hidden; }
.menu-item { padding: 24rpx 40rpx; font-size: 28rpx; border-bottom: 1rpx solid #f0f0f0; }
.context-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 199; }
/* Message status styles */
.message.pending { opacity: 0.6; }
.message.failed .message-bubble { border: 2rpx solid #ff4d4f; }
.message-status { font-size: 22rpx; margin-top: 4rpx; }
.message-status.pending { color: #888; }
.message-status.failed { color: #ff4d4f; cursor: pointer; }
.message-status.delivered { color: #52c41a; }
.message.self .message-status { text-align: right; }

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    backdrop-filter: blur(5px);
}
.modal-content {
    width: 600rpx;
    background: #2c2c2c;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.5);
    border: 1rpx solid #3a3a3a;
    animation: modal-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-header {
    padding: 30rpx 0;
    text-align: center;
    border-bottom: 1rpx solid #3a3a3a;
}
.modal-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #fff;
    letter-spacing: 1rpx;
}
.modal-body {
    padding: 50rpx 40rpx;
    display: flex;
    justify-content: center;
    align-items: center;
}
.modal-text {
    font-size: 32rpx;
    color: #ddd;
    text-align: center;
}
.modal-footer {
    display: flex;
    border-top: 1rpx solid #3a3a3a;
}
.modal-btn {
    flex: 1;
    padding: 32rpx;
    text-align: center;
    font-size: 32rpx;
    font-weight: 500;
    transition: background 0.2s;
}
.modal-btn.cancel {
    color: #999;
    border-right: 1rpx solid #3a3a3a;
}
.modal-btn.confirm {
    color: #ff4d4f;
}
.modal-btn:active {
    background: #3a3a3a;
}
@keyframes modal-scale {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
}
</style>
