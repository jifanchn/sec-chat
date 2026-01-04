/**
 * SecChat WebSocket Module for uni-app
 */

class SecWebSocket {
    constructor() {
        this.socket = null;
        this.serverUrl = '';
        this.reconnectAttempts = 0;
        this.maxReconnectDelay = 10000;
        this.baseReconnectDelay = 3000;
        this.listeners = {};
        this.connected = false;
        this.authenticated = false;
    }

    connect(serverUrl) {
        return new Promise((resolve, reject) => {
            this.serverUrl = serverUrl;

            // Set timeout to avoid hanging forever
            const timeout = setTimeout(() => {
                reject(new Error('连接超时'));
            }, 10000);

            // Detect if running in H5 environment
            const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';

            if (isH5) {
                // H5: Use native WebSocket for better compatibility
                console.log('[WebSocket] Using native WebSocket for H5');
                try {
                    const ws = new WebSocket(serverUrl);
                    this.socket = ws;

                    ws.onopen = () => {
                        clearTimeout(timeout);
                        this.connected = true;
                        this.reconnectAttempts = 0;
                        this.emit('connected');
                        console.log('[WebSocket] Connected');
                        resolve();
                    };

                    ws.onerror = (err) => {
                        clearTimeout(timeout);
                        console.error('[WebSocket] Error:', err);
                        this.emit('error', err);
                        reject(new Error('连接错误'));
                    };

                    ws.onmessage = (event) => {
                        this.handleMessage(event.data);
                    };

                    ws.onclose = () => {
                        this.connected = false;
                        this.authenticated = false;
                        this.emit('disconnected');
                        this.scheduleReconnect();
                    };
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            } else {
                // App/MiniProgram: Use uni.connectSocket
                try {
                    this.socket = uni.connectSocket({
                        url: serverUrl,
                        success: () => console.log('WebSocket connecting...'),
                        fail: (err) => {
                            clearTimeout(timeout);
                            console.error('WebSocket connect failed:', err);
                            reject(new Error('连接失败'));
                        }
                    });

                    const onOpen = () => {
                        clearTimeout(timeout);
                        this.connected = true;
                        this.reconnectAttempts = 0;
                        this.emit('connected');
                        uni.offSocketOpen(onOpen);
                        uni.offSocketError(onError);
                        resolve();
                    };

                    const onError = (err) => {
                        clearTimeout(timeout);
                        console.error('WebSocket error:', err);
                        uni.offSocketOpen(onOpen);
                        uni.offSocketError(onError);
                        this.emit('error', err);
                        reject(new Error('连接错误'));
                    };

                    uni.onSocketOpen(onOpen);
                    uni.onSocketError(onError);
                    uni.onSocketMessage((res) => this.handleMessage(res.data));
                    uni.onSocketClose((res) => {
                        this.connected = false;
                        this.authenticated = false;
                        this.emit('disconnected', res);
                        this.scheduleReconnect();
                    });
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
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
        if (!this.connected) return;

        const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
        const message = typeof data === 'string' ? data : JSON.stringify(data);

        if (isH5 && this.socket instanceof WebSocket) {
            // H5: Use native WebSocket
            this.socket.send(message);
        } else {
            // App/MiniProgram: Use uni.sendSocketMessage
            uni.sendSocketMessage({ data: message });
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
        const delay = Math.min(this.baseReconnectDelay * this.reconnectAttempts, this.maxReconnectDelay);
        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
        setTimeout(() => {
            this.connect(this.serverUrl).catch(() => this.scheduleReconnect());
        }, delay);
    }

    disconnect() {
        const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';

        if (isH5 && this.socket instanceof WebSocket) {
            // H5: Use native WebSocket close
            if (this.socket) {
                this.socket.close();
                this.socket = null;
            }
        } else {
            // App/MiniProgram: Use uni.closeSocket
            if (this.socket) {
                uni.closeSocket();
                this.socket = null;
            }
        }
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
