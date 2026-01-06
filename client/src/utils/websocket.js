/**
 * SecChat WebSocket Module for uni-app
 * With heartbeat and connection status monitoring
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
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        this.pendingMessages = new Map(); // Track pending messages for delivery confirmation
        this.serverVersion = null;
        // Store auth credentials for reconnection
        this.authCredentials = null;
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
                        this.startHeartbeat();
                        this.emit('connected');
                        console.log('[WebSocket] Connected');
                        
                        // Auto-authenticate on reconnection
                        if (this.authCredentials) {
                            console.log('[WebSocket] Re-authenticating after reconnection');
                            this.authenticate(
                                this.authCredentials.passwordHash,
                                this.authCredentials.userId,
                                this.authCredentials.userName,
                                this.authCredentials.avatar
                            );
                        }
                        
                        resolve();
                    };

                    ws.onerror = (err) => {
                        clearTimeout(timeout);
                        console.error('[WebSocket] Error:', err);
                        this.emit('error', err);
                        reject(new Error('连接错误'));
                    };

                    ws.onmessage = (event) => {
                        this.resetHeartbeatTimeout();
                        this.handleMessage(event.data);
                    };

                    ws.onclose = (event) => {
                        console.log('[WebSocket] Closed, code:', event.code, 'reason:', event.reason);
                        this.connected = false;
                        this.authenticated = false;
                        this.stopHeartbeat();
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
                        this.startHeartbeat();
                        this.emit('connected');
                        
                        // Auto-authenticate on reconnection
                        if (this.authCredentials) {
                            console.log('[WebSocket] Re-authenticating after reconnection');
                            this.authenticate(
                                this.authCredentials.passwordHash,
                                this.authCredentials.userId,
                                this.authCredentials.userName,
                                this.authCredentials.avatar
                            );
                        }
                        
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
                    uni.onSocketMessage((res) => {
                        this.resetHeartbeatTimeout();
                        this.handleMessage(res.data);
                    });
                    uni.onSocketClose((res) => {
                        this.connected = false;
                        this.authenticated = false;
                        this.stopHeartbeat();
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

    // Start heartbeat to keep connection alive
    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing
        
        // Send heartbeat every 5 seconds to keep connection alive
        this.heartbeatInterval = setInterval(() => {
            if (this.connected) {
                console.log('[WebSocket] Sending heartbeat');
                this.send({ type: 'ping' });
            }
        }, 5000);
        
        this.resetHeartbeatTimeout();
    }

    // Reset the heartbeat timeout (called when we receive any message)
    resetHeartbeatTimeout() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
        }
        
        // If we don't receive any message for 45 seconds, assume connection is dead
        this.heartbeatTimeout = setTimeout(() => {
            console.warn('[WebSocket] No response for 45 seconds, reconnecting...');
            this.forceReconnect();
        }, 45000);
    }

    // Stop heartbeat
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    // Force reconnect
    forceReconnect() {
        console.log('[WebSocket] Force reconnecting...');
        this.stopHeartbeat();
        this.connected = false;
        this.authenticated = false;
        
        const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
        if (isH5 && this.socket instanceof WebSocket) {
            try { this.socket.close(); } catch (e) {}
        } else if (this.socket) {
            try { uni.closeSocket(); } catch (e) {}
        }
        this.socket = null;
        
        this.emit('disconnected');
        this.scheduleReconnect();
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const type = message.type;
            
            // Handle pong response
            if (type === 'pong') {
                console.log('[WebSocket] Received pong', message.version);
                if (message.version) {
                    if (this.serverVersion === null) {
                        this.serverVersion = message.version;
                        console.log('[WebSocket] Server version:', this.serverVersion);
                    } else if (this.serverVersion !== message.version) {
                        console.log('[WebSocket] Version changed:', this.serverVersion, '->', message.version);
                        // Version changed, reload page
                        // Only reload in H5/Browser environment
                        if (typeof window !== 'undefined' && window.location) {
                             console.log('[WebSocket] Reloading page due to version update...');
                             window.location.reload();
                        }
                    }
                }
                return;
            }
            
            if (type === 'auth_success') { 
                this.authenticated = true; 
            }
            
            // Handle message delivery confirmation
            if ((type === 'text' || type === 'image') && message.id) {
                if (this.pendingMessages.has(message.id)) {
                    const callback = this.pendingMessages.get(message.id);
                    this.pendingMessages.delete(message.id);
                    if (callback) callback(true, message);
                }
            }
            
            this.emit(type === 'text' || type === 'image' ? 'message' : type, message);
        } catch (error) {
            console.error('Parse failed:', error);
        }
    }

    authenticate(passwordHash, userId, userName, avatar) {
        // Store credentials for reconnection
        this.authCredentials = { passwordHash, userId, userName, avatar };
        this.send({ type: 'auth', payload: { passwordHash, userId, userName, avatar } });
    }

    send(data) {
        if (!this.connected) {
            console.warn('[WebSocket] Not connected, cannot send');
            return false;
        }

        const isH5 = typeof window !== 'undefined' && typeof document !== 'undefined';
        const message = typeof data === 'string' ? data : JSON.stringify(data);

        try {
            if (isH5 && this.socket instanceof WebSocket) {
                // H5: Use native WebSocket
                if (this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(message);
                    return true;
                } else {
                    console.warn('[WebSocket] Socket not open, state:', this.socket.readyState);
                    return false;
                }
            } else {
                // App/MiniProgram: Use uni.sendSocketMessage
                uni.sendSocketMessage({ data: message });
                return true;
            }
        } catch (error) {
            console.error('[WebSocket] Send error:', error);
            return false;
        }
    }

    sendMessage(type, content, options = {}) {
        const id = options.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 9));
        const sent = this.send({ type, id, content, timestamp: Date.now(), ...options });
        
        if (sent) {
            // Track pending message with 10 second timeout
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.pendingMessages.delete(id);
                    reject(new Error('Message delivery timeout'));
                }, 10000);
                
                this.pendingMessages.set(id, (success, message) => {
                    clearTimeout(timeout);
                    if (success) resolve({ id, message });
                    else reject(new Error('Message delivery failed'));
                });
            });
        } else {
            return Promise.reject(new Error('Not connected'));
        }
    }

    // Legacy sync version for compatibility
    sendMessageSync(type, content, options = {}) {
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
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => {
            this.connect(this.serverUrl).catch(() => this.scheduleReconnect());
        }, delay);
    }

    disconnect() {
        this.stopHeartbeat();
        this.reconnectAttempts = 999; // Prevent auto-reconnect
        this.authCredentials = null; // Clear stored credentials
        
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
        
        this.connected = false;
        this.authenticated = false;
    }

    // Check if currently connected
    isConnected() {
        return this.connected && this.authenticated;
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

const instance = new SecWebSocket();

// Expose to window for E2E testing
if (typeof window !== 'undefined') {
    window.SecWebSocketInstance = instance;
}

export default instance;
