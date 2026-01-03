<template>
    <view class="members-page">
        <view class="members-list">
            <view v-for="member in members" :key="member.id" class="member-item">
                <view class="member-avatar"><text>{{ getAvatarChar(member.name) }}</text></view>
                <view class="member-info">
                    <text class="member-name">{{ member.name }}<text v-if="member.id === userId" class="self-tag"> (我)</text></text>
                    <text class="member-status" :class="{ online: member.online }">{{ member.online ? '在线' : '离线' }}</text>
                </view>
            </view>
            <view v-if="members.length === 0" class="empty-state"><text>暂无成员</text></view>
        </view>
    </view>
</template>

<script>
import SecWebSocket from '@/utils/websocket.js';

export default {
    data() {
        return { userId: '', members: [] };
    },
    onLoad() {
        this.userId = getApp().globalData.userId;
        SecWebSocket.on('users', this.onUsers);
        this.loadMembers();
    },
    methods: {
        async loadMembers() {
            try {
                const app = getApp();
                const httpUrl = app.globalData.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
                const [err, res] = await uni.request({ url: `${httpUrl}/api/members`, method: 'GET' });
                if (!err && res.data?.members) this.members = res.data.members;
            } catch (error) { console.error('Load members failed:', error); }
        },
        onUsers(data) { if (data.users) this.members = data.users; },
        getAvatarChar(name) { return (name || '?').charAt(0).toUpperCase(); }
    },
    onUnload() { SecWebSocket.off('users', this.onUsers); }
};
</script>

<style scoped>
.members-page { min-height: 100vh; background: #f5f5f5; }
.members-list { background: #fff; }
.member-item { display: flex; align-items: center; gap: 24rpx; padding: 24rpx 30rpx; border-bottom: 1rpx solid #f0f0f0; }
.member-avatar { width: 88rpx; height: 88rpx; border-radius: 8rpx; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; }
.member-avatar text { color: #fff; font-size: 36rpx; font-weight: 600; }
.member-info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.member-name { font-size: 32rpx; font-weight: 500; }
.self-tag { color: #07c160; font-size: 24rpx; }
.member-status { font-size: 26rpx; color: #888; }
.member-status.online { color: #07c160; }
.empty-state { padding: 100rpx; text-align: center; color: #888; font-size: 28rpx; }
</style>
