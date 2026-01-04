/**
 * SecChat E2E Test Helpers
 */
const puppeteer = require('puppeteer');
const WebSocket = require('ws');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const WS_URL = process.env.WS_URL || 'ws://127.0.0.1:8081/ws';
const DEFAULT_PASSWORD = 'test123';

/**
 * Launch Puppeteer browser
 */
async function launchBrowser() {
    const headless = process.env.HEADLESS !== 'false';
    return await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 414, height: 896 }
    });
}

/**
 * Attach console logger to page
 */
function attachLogger(page) {
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') console.error(`[PAGE ERROR] ${text}`);
        else console.log(`[PAGE LOG] ${text}`);
    });
    page.on('pageerror', err => console.error(`[PAGE EXCEPTION] ${err.toString()}`));
}

/**
 * Wait for a specific amount of time
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate SHA256 hash of password (matches client crypto.js)
 */
async function hashPassword(password) {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash;
}

/**
 * Generate random user ID
 */
function generateUserId() {
    return 'user_' + crypto.randomBytes(8).toString('hex');
}

/**
 * Login to SecChat via browser
 */
async function login(page, nickname, password = DEFAULT_PASSWORD) {
    attachLogger(page);
    await page.goto(BASE_URL);
    await page.waitForSelector('.input-field');

    console.log('[LOGIN] Filling form with nickname:', nickname);

    // Fill each input with focus, type, and blur
    // Server URL
    await page.click('.input-group:nth-child(1) .input-field');
    await sleep(50);
    await page.keyboard.type(WS_URL);
    await sleep(100);

    // Password
    await page.click('.input-group:nth-child(2) .input-field');
    await sleep(50);
    await page.keyboard.type(password);
    await sleep(100);

    // Nickname
    await page.click('.input-group:nth-child(3) .input-field');
    await sleep(50);
    await page.keyboard.type(nickname);
    await sleep(100);

    console.log('[LOGIN] Clicking login button...');

    // Click login button
    await page.click('.login-btn');

    // Wait a bit for login processing
    await sleep(2000);

    // Check if there's an error
    const errorBox = await page.$('.error-box');
    if (errorBox) {
        const errorText = await page.$eval('.error-text', el => el.textContent);
        console.error('[LOGIN] Login error:', errorText);
        throw new Error(`Login failed: ${errorText}`);
    }

    // Check current URL
    const url = page.url();
    console.log('[LOGIN] Current URL after login:', url);

    // Check if still on login page
    const stillLogin = await page.$('.login-page');
    if (stillLogin) {
        console.error('[LOGIN] Still on login page after 2 seconds');
        // Take screenshot
        await screenshot(page, 'login_stuck');
    }

    // Wait for redirect to chat page
    console.log('[LOGIN] Waiting for .chat-page...');
    await page.waitForSelector('.chat-page', { timeout: 10000 });
    console.log('[LOGIN] Successfully navigated to chat page');
    await sleep(500); // Let messages load
}

/**
 * Send a text message in chat
 */
async function sendMessage(page, text) {
    console.log('[TEST] sendMessage called with:', text);

    // Click message input and type
    await page.click('.message-input');
    await sleep(50);

    // Clear existing content and type new message
    await page.evaluate(() => {
        const textarea = document.querySelector('.message-input');
        if (textarea) {
            textarea.value = '';
        }
    });
    await sleep(50);

    await page.keyboard.type(text);
    await sleep(200);

    // Click send button
    await page.click('.send-btn');

    console.log('[TEST] Message sent, waiting for render...');
    await sleep(1000); // Wait for message to be sent and rendered
}

/**
 * Wait for a message containing specific text
 */
async function waitForMessage(page, text, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const messages = await page.$$eval('.message-bubble', els => 
            els.map(el => el.textContent)
        );
        if (messages.some(m => m && m.includes(text))) {
            return true;
        }
        await sleep(100);
    }
    
    // Debug failure
    await screenshot(page, 'missing_message');
    const visible = await getMessages(page);
    console.error('Visible messages:', visible);
    
    // Dump checks
    const hasChatList = await page.$('.chat-list') !== null;
    const messageItems = await page.$$eval('.message-item', els => els.length);
    console.error('Debug state:', { hasChatList, messageItems });
    // const content = await page.content();
    // console.error('Page content:', content);
    
    throw new Error(`Message containing "${text}" not found within ${timeout}ms`);
}

/**
 * Wait for system message containing specific text
 */
async function waitForSystemMessage(page, text, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const messages = await page.$$eval('.system-message', els => 
            els.map(el => el.textContent)
        );
        if (messages.some(m => m && m.includes(text))) {
            return true;
        }
        await sleep(100);
    }
    throw new Error(`System message containing "${text}" not found within ${timeout}ms`);
}

/**
 * Get all visible messages
 */
async function getMessages(page) {
    return await page.$$eval('.message-bubble', els => 
        els.map(el => el.textContent).filter(t => t)
    );
}

/**
 * Create WebSocket client for multi-user tests
 */
async function createWSClient(nickname, password = DEFAULT_PASSWORD) {
    return new Promise(async (resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        const userId = generateUserId();
        const passwordHash = await hashPassword(password);
        const encryptionKey = await deriveKey(password);
        
        ws.on('open', () => {
            // Send auth message
            ws.send(JSON.stringify({
                type: 'auth',
                payload: {
                    passwordHash,
                    userId,
                    userName: nickname
                }
            }));
        });
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'auth_success') {
                    resolve({
                        ws,
                        userId,
                        nickname,
                        encryptionKey,
                        send: (text) => sendWSMessage(ws, text, encryptionKey),
                        sendTyping: () => sendWSTyping(ws),
                        close: () => ws.close()
                    });
                } else if (msg.type === 'error') {
                    reject(new Error(msg.message));
                }
            } catch (e) {
                // Ignore parse errors
            }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    });
}

/**
 * Derive encryption key from password (matching client crypto.js)
 */
async function deriveKey(password) {
    const str = password + 'SecChatSalt2024!';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    const key = [];
    for (let i = 0; i < 32; i++) {
        key.push(Math.abs((hash * (i + 1)) % 256));
    }
    return new Uint8Array(key);
}

/**
 * Encrypt message (matching client crypto.js)
 */
async function encryptMessage(message, key) {
    const data = Buffer.from(message, 'utf-8');
    const iv = Buffer.allocUnsafe(12);
    for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
    
    const encrypted = Buffer.allocUnsafe(data.length);
    for (let i = 0; i < data.length; i++) {
        encrypted[i] = data[i] ^ key[i % key.length] ^ iv[i % iv.length];
    }
    
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString('base64');
}

/**
 * Send message via WebSocket (encrypted like client does)
 */
async function sendWSMessage(ws, text, encryptionKey) {
    const msgId = 'msg_' + crypto.randomBytes(8).toString('hex');
    const encryptedContent = await encryptMessage(text, encryptionKey);
    ws.send(JSON.stringify({
        type: 'text',
        id: msgId,
        content: encryptedContent,
        timestamp: Date.now()
    }));
}

/**
 * Send typing indicator via WebSocket
 */
function sendWSTyping(ws) {
    ws.send(JSON.stringify({ type: 'typing' }));
}

/**
 * Take a screenshot with timestamp
 */
async function screenshot(page, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshots/${name}_${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`Screenshot saved: ${filename}`);
    return filename;
}

/**
 * Cleanup: Close all resources
 */
async function cleanup(browser, wsClients = []) {
    for (const client of wsClients) {
        try { client.close(); } catch (e) {}
    }
    if (browser) {
        await browser.close();
    }
}

/**
 * Upload an image file in chat
 * @param {Page} page - Puppeteer page
 * @param {string} imagePath - Absolute path to image file
 */
async function uploadImage(page, imagePath) {
    console.log('[TEST] uploadImage called with:', imagePath);
    
    // Click the camera button (second tool-btn)
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('.tool-btn:nth-child(2)')
    ]);
    
    await fileChooser.accept([imagePath]);
    console.log('[TEST] File selected, waiting for upload...');
    
    // Wait for upload to complete
    await sleep(3000);
}

/**
 * Wait for an image message to appear in chat
 * @param {Page} page - Puppeteer page  
 * @param {number} timeout - Timeout in ms
 * @returns {boolean} True if image found
 */
async function waitForImageMessage(page, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const hasImage = await page.evaluate(() => {
            // Check for image message bubbles
            const imageBubbles = document.querySelectorAll('.message-bubble.image');
            if (imageBubbles.length > 0) {
                // Check if any bubble has an img element with src (uni-app renders <image> as <img> in H5)
                for (const bubble of imageBubbles) {
                    const img = bubble.querySelector('img');
                    if (img && img.getAttribute('src')) {
                        return true;
                    }
                }
            }
            return false;
        });

        if (hasImage) {
            console.log('[TEST] Image message found');
            return true;
        }
        await sleep(200);
    }

    // Debug failure
    await screenshot(page, 'missing_image');
    throw new Error(`Image message not found within ${timeout}ms`);
}

module.exports = {
    launchBrowser,
    attachLogger,
    sleep,
    login,
    sendMessage,
    waitForMessage,
    waitForSystemMessage,
    getMessages,
    createWSClient,
    screenshot,
    cleanup,
    uploadImage,
    waitForImageMessage,
    hashPassword,
    generateUserId,
    BASE_URL,
    WS_URL,
    DEFAULT_PASSWORD
};
