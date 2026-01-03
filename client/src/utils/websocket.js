/**
 * SecChat WebSocket Module for uni-app
 */

class SecWebSocket {
    constructor() {
        this.socket = null;
        this.serverUrl = '';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.listeners = {};
        this.connected = false;
        this.authenticated = false;
    }

    connect(serverUrl) {
        return new Promise((resolve, reject) => {
            this.serverUrl = serverUrl;
            
            try {
                this.socket = uni.connectSocket({
                    url: serverUrl,
                    success: () => console.log('WebSocket connecting...'),
                    fail: (err) => {
                        console.error('WebSocket connect failed:', err);
                        reject(new Error('连接失败'));
                    }
                });

                uni.onSocketOpen(() => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.emit('connected');
                    resolve();
                });

                uni.onSocketMessage((res) => this.handleMessage(res.data));

                uni.onSocketClose((res) => {
                    this.connected = false;
                    this.authenticated = false;
                    this.emit('disconnected', res);
                    if (this.reconnectAttempts < this.maxReconnectAttempts) this.scheduleReconnect();
                });

                uni.onSocketError((err) => {
                    this.emit('error', err);
                    reject(new Error('连接错误'));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const type = message.type;
            if (type === 'auth_success') { this.authenticated = true; }
            this.emit(type === 'text' || type === 'image' ? 'message' : type, message);
        } catch (error) {
            console.error('Parse failed:', error);
        }
    }

    authenticate(passwordHash, userId, userName) {
        this.send({ type: 'auth', payload: { passwordHash, userId, userName } });
    }

    send(data) {
        if (this.connected) {
            uni.sendSocketMessage({
                data: typeof data === 'string' ? data : JSON.stringify(data)
            });
        }
    }

    sendMessage(type, content, options = {}) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        this.send({ type, id, content, timestamp: Date.now(), ...options });
        return id;
    }

    sendTyping() { this.send({ type: 'typing' }); }
    sendRecall(messageId) { this.send({ type: 'recall', id: messageId }); }
    sendRead(messageId) { this.send({ type: 'read', id: messageId }); }

    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
        setTimeout(() => {
            this.connect(this.serverUrl).catch(() => {
                if (this.reconnectAttempts < this.maxReconnectAttempts) this.scheduleReconnect();
                else this.emit('reconnect_failed');
            });
        }, delay);
    }

    disconnect() {
        if (this.socket) { uni.closeSocket(); this.socket = null; }
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners[event]) {
            const idx = this.listeners[event].indexOf(callback);
            if (idx > -1) this.listeners[event].splice(idx, 1);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
    }
}

export default new SecWebSocket();
