/**
 * SecChat E2E Test Helpers
 */
const puppeteer = require('puppeteer');
const WebSocket = require('ws');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5173';
const WS_URL = 'ws://localhost:8080/ws';
const DEFAULT_PASSWORD = 'test123';

/**
 * Launch Puppeteer browser
 */
async function launchBrowser() {
    const headless = process.env.HEADLESS !== 'false';
    return await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 414, height: 896 } // iPhone XR viewport
    });
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
    await page.goto(BASE_URL);
    await page.waitForSelector('.input-field');
    
    // Fill server URL
    const serverInput = await page.$('.input-group:nth-child(1) .input-field');
    await serverInput.click({ clickCount: 3 }); // Select all
    await serverInput.type(WS_URL);
    
    // Fill password
    const passwordInput = await page.$('.input-group:nth-child(2) .input-field');
    await passwordInput.type(password);
    
    // Fill nickname
    const nicknameInput = await page.$('.input-group:nth-child(3) .input-field');
    await nicknameInput.type(nickname);
    
    // Click login button
    await page.click('.login-btn');
    
    // Wait for redirect to chat page
    await page.waitForSelector('.chat-page', { timeout: 10000 });
    await sleep(500); // Let messages load
}

/**
 * Send a text message in chat
 */
async function sendMessage(page, text) {
    const textarea = await page.$('.message-input');
    await textarea.type(text);
    await page.click('.send-btn');
    await sleep(300); // Wait for message to be sent
}

/**
 * Wait for a message containing specific text
 */
async function waitForMessage(page, text, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const messages = await page.$$eval('.message-bubble text', els => 
            els.map(el => el.textContent)
        );
        if (messages.some(m => m && m.includes(text))) {
            return true;
        }
        await sleep(100);
    }
    throw new Error(`Message containing "${text}" not found within ${timeout}ms`);
}

/**
 * Wait for system message containing specific text
 */
async function waitForSystemMessage(page, text, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const messages = await page.$$eval('.system-message text', els => 
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
    return await page.$$eval('.message-bubble text', els => 
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
        
        ws.on('open', () => {
            // Send auth message
            ws.send(JSON.stringify({
                type: 'auth',
                payload: JSON.stringify({
                    passwordHash,
                    userId,
                    userName: nickname
                })
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
                        send: (text) => sendWSMessage(ws, text),
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
 * Send message via WebSocket (encrypted like client does)
 * Note: For testing, we send encrypted content that matches the format
 */
async function sendWSMessage(ws, text) {
    // For simplicity, we send a mock encrypted message
    // In real tests, you'd use the same encryption as client
    const msgId = 'msg_' + crypto.randomBytes(8).toString('hex');
    ws.send(JSON.stringify({
        type: 'text',
        id: msgId,
        content: text, // In real scenario, this would be encrypted
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

module.exports = {
    launchBrowser,
    sleep,
    login,
    sendMessage,
    waitForMessage,
    waitForSystemMessage,
    getMessages,
    createWSClient,
    screenshot,
    cleanup,
    hashPassword,
    generateUserId,
    BASE_URL,
    WS_URL,
    DEFAULT_PASSWORD
};
