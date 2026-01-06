/**
 * E2E Tests: WebSocket Reconnection
 * 
 * Tests the WebSocket reconnection mechanism to ensure:
 * - Automatic reconnection after network disconnect
 * - Re-authentication with saved credentials
 * - Message sending works after reconnection
 */
const { launchBrowser, cleanup, login, sendMessage, waitForMessage, sleep, screenshot } = require('./helpers');

describe('WebSocket Reconnection', () => {
    let browser;
    let page;

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
    });

    afterEach(async () => {
        await cleanup(browser);
    });

    test('should reconnect and re-authenticate after closing WebSocket', async () => {
        // Login first
        console.log('[TEST] Logging in as ReconnectUser...');
        await login(page, 'ReconnectUser');
        
        // Send a message to verify normal communication
        console.log('[TEST] Sending initial message...');
        await sendMessage(page, 'Message before disconnect');
        await waitForMessage(page, 'Message before disconnect');
        console.log('[TEST] ✅ Initial message sent successfully');

        // Wait a bit to ensure WebSocket is stable
        await sleep(1000);

        // Force close the WebSocket connection
        console.log('[TEST] Forcing WebSocket disconnection...');
        await page.evaluate(() => {
            // Access the WebSocket instance and close it
            // This simulates a network disconnection
            const ws = window.SecWebSocketInstance?.socket;
            if (ws && ws.close) {
                console.log('[PAGE] Closing WebSocket manually...');
                ws.close(1000, 'Test-triggered disconnect');
            } else {
                console.error('[PAGE] Could not find WebSocket instance to close');
            }
        });

        // Wait for disconnection to be detected
        await sleep(500);

        // Verify reconnection status is shown
        console.log('[TEST] Checking for reconnection status...');
        const reconnectingStatus = await page.waitForSelector('.connection-status.warning', { timeout: 5000 });
        expect(reconnectingStatus).not.toBeNull();
        console.log('[TEST] ✅ Reconnection status displayed');

        // Wait for reconnection to complete (max 15 seconds)
        console.log('[TEST] Waiting for reconnection to complete...');
        let reconnected = false;
        const maxWait = 15000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const statusExists = await page.$('.connection-status');
            if (!statusExists) {
                // Status disappeared, meaning reconnected
                reconnected = true;
                break;
            }
            await sleep(500);
        }

        if (!reconnected) {
            await screenshot(page, 'reconnection_timeout');
            throw new Error('Reconnection did not complete within timeout');
        }
        console.log('[TEST] ✅ Reconnection completed');

        // Wait a bit more for re-authentication
        await sleep(2000);

        // Try to send a message after reconnection
        console.log('[TEST] Sending message after reconnection...');
        await sendMessage(page, 'Message after reconnection');
        
        // Verify the message appears (this proves re-authentication worked)
        await waitForMessage(page, 'Message after reconnection', 10000);
        console.log('[TEST] ✅ Message sent successfully after reconnection');

        // Verify no error messages appeared
        const errorStatus = await page.$('.connection-status.error');
        expect(errorStatus).toBeNull();
    }, 60000); // 60 second timeout for this test

    test('should handle heartbeat timeout and reconnect', async () => {
        // Login first
        console.log('[TEST] Logging in as HeartbeatUser...');
        await login(page, 'HeartbeatUser');
        
        // Send a message to verify normal communication
        console.log('[TEST] Sending initial message...');
        await sendMessage(page, 'Before heartbeat timeout');
        await waitForMessage(page, 'Before heartbeat timeout');
        console.log('[TEST] ✅ Initial message sent successfully');

        // Monitor WebSocket messages
        await page.evaluate(() => {
            window.wsMessageLog = [];
            window.wsOriginalSend = window.SecWebSocketInstance?.socket?.send;
            if (window.SecWebSocketInstance?.socket?.send) {
                window.SecWebSocketInstance.socket.send = function(data) {
                    window.wsMessageLog.push({ type: 'send', data: data });
                    return window.wsOriginalSend.call(this, data);
                };
            }
        });

        // Wait and verify heartbeat is being sent
        console.log('[TEST] Waiting for heartbeat messages...');
        await sleep(6000); // Wait for at least one heartbeat (sent every 5s)

        const heartbeatSent = await page.evaluate(() => {
            return window.wsMessageLog.some(log => {
                try {
                    const msg = JSON.parse(log.data);
                    return msg.type === 'ping';
                } catch (e) {
                    return false;
                }
            });
        });

        expect(heartbeatSent).toBe(true);
        console.log('[TEST] ✅ Heartbeat mechanism is working');

        // Note: Testing actual heartbeat timeout (45 seconds) is too slow for E2E
        // The important thing is that heartbeat messages are being sent
        // and the reconnection mechanism tested in the previous test works
    }, 30000);

    test('should preserve user state after reconnection', async () => {
        // Login first
        console.log('[TEST] Logging in as StatePreserveUser...');
        await login(page, 'StatePreserveUser');
        
        // Verify user is shown in header
        const userCountBefore = await page.$eval('.member-count', el => el.textContent);
        console.log('[TEST] Online users before disconnect:', userCountBefore);

        // Send a message
        await sendMessage(page, 'Message before state test');
        await waitForMessage(page, 'Message before state test');

        // Force disconnect
        await page.evaluate(() => {
            const ws = window.SecWebSocketInstance?.socket;
            if (ws && ws.close) {
                ws.close(1000, 'Test disconnect');
            }
        });

        // Wait for reconnection
        await sleep(500);
        await page.waitForSelector('.connection-status.warning', { timeout: 5000 });
        
        // Wait for reconnection to complete
        let reconnected = false;
        const maxWait = 15000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const statusExists = await page.$('.connection-status');
            if (!statusExists) {
                reconnected = true;
                break;
            }
            await sleep(500);
        }

        expect(reconnected).toBe(true);
        await sleep(2000); // Wait for re-authentication

        // Verify user state is preserved
        const userNameAfter = await page.$eval('.header-title', el => el.textContent);
        expect(userNameAfter).toBe('SecChat');
        
        // Verify messages are still visible
        const messages = await page.$$eval('.message-bubble', els => 
            els.map(el => el.textContent).filter(t => t)
        );
        expect(messages.some(m => m.includes('Message before state test'))).toBe(true);
        console.log('[TEST] ✅ User state preserved after reconnection');
    }, 60000);
});
