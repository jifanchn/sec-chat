<template>
    <view class="members-page">
        <view class="nav-bar">
            <view class="nav-back" @click="goBack">‹</view>
            <text class="nav-title">群成员</text>
            <view class="nav-placeholder"></view>
        </view>
        <view class="members-header">
            <text class="header-title">在线成员</text>
            <text class="member-count">{{ onlineMembers.length }}人</text>
        </view>
        <view class="members-list">
            <view v-for="member in onlineMembers" :key="member.id" class="member-item">
                <view class="member-avatar">
                    <image v-if="member.avatar" :src="member.avatar" mode="aspectFill" class="avatar-image"/>
                    <text v-else>{{ getAvatarChar(member.name) }}</text>
                </view>
                <view class="member-info">
                    <text class="member-name">{{ member.name }}<text v-if="member.id === userId" class="self-tag"> (我)</text></text>
                    <view class="online-indicator"><view class="online-dot"></view><text>在线</text></view>
                </view>
            </view>
            <view v-if="onlineMembers.length === 0" class="empty-state"><text>暂无在线成员</text></view>
        </view>
    </view>
</template>

<script>
import SecWebSocket from '@/utils/websocket.js';

export default {
    data() {
        return { userId: '', members: [] };
    },
    computed: {
        onlineMembers() {
            return this.members.filter(m => m.online);
        }
    },
    onLoad() {
        this.userId = getApp().globalData.userId;
        this.userName = getApp().globalData.userName;
        SecWebSocket.on('users', this.onUsers);
        // Initialize with current online users from WebSocket cached data and fetch from API
        this.initMembers();
        this.loadMembers();
    },
    methods: {
        initMembers() {
            // Ensure self is in the list initially
            this.members = this.ensureSelf([]);
        },
        async loadMembers() {
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                const response = await uni.request({ url: `${httpUrl}/api/members`, method: 'GET' });
                let err = null, res = null;
                // Handle different uni.request return formats
                if (Array.isArray(response)) { [err, res] = response; }
                else { res = response; }

                if (!err && res.data?.members) {
                    this.members = this.ensureSelf(res.data.members);
                    console.log('[MEMBERS] Loaded from API:', this.members.length);
                } else {
                    console.error('Failed to load members:', err || res);
                }
            } catch (error) { console.error('Load members exception:', error); }
        },
        onUsers(data) { 
            if (data.users) {
                this.members = this.ensureSelf(data.users); 
            }
        },
        ensureSelf(list) {
            if (!list.find(m => m.id === this.userId)) {
                return [...list, { 
                    id: this.userId, 
                    name: this.userName || getApp().globalData.userName, 
                    online: true,
                    avatar: getApp().globalData.avatarUrl 
                }];
            }
            return list;
        },
        getAvatarChar(name) { return (name || '?').charAt(0).toUpperCase(); },
        goBack() { uni.navigateBack(); }
    },
    onUnload() { SecWebSocket.off('users', this.onUsers); }
};
</script>

<style scoped>
.members-page { min-height: 100vh; background: #1e1e1e; }
.nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background: linear-gradient(135deg, #667eea, #764ba2); padding-top: calc(20rpx + var(--status-bar-height)); }
.nav-back { font-size: 60rpx; font-weight: 300; color: #fff; padding: 0 20rpx; line-height: 1; }
.nav-title { font-size: 36rpx; font-weight: 600; color: #fff; }
.nav-placeholder { width: 60rpx; }
.members-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background: #2c2c2c; border-bottom: 1rpx solid #333; }
.header-title { font-size: 36rpx; font-weight: 600; color: #fff; }
.member-count { font-size: 24rpx; color: #888; }
.members-list { background: #2c2c2c; }
.member-item { display: flex; align-items: center; gap: 24rpx; padding: 24rpx 30rpx; border-bottom: 1rpx solid #333; }
.member-avatar { width: 80rpx; height: 80rpx; border-radius: 8rpx; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.member-avatar text { color: #fff; font-size: 32rpx; font-weight: 600; }
.avatar-image { width: 100%; height: 100%; }
.member-info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.member-name { font-size: 30rpx; font-weight: 500; color: #fff; }
.self-tag { color: #07c160; font-size: 24rpx; }
.online-indicator { display: flex; align-items: center; gap: 8rpx; font-size: 24rpx; color: #07c160; }
.online-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: #07c160; }
.empty-state { padding: 100rpx; text-align: center; color: #888; font-size: 28rpx; }
</style>
