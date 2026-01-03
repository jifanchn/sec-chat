/**
 * E2E Tests: Messaging
 */
const { launchBrowser, login, sleep, sendMessage, waitForMessage, getMessages, cleanup, createWSClient } = require('./helpers');

describe('Messaging', () => {
    let browser;
    let page;

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
    });

    afterEach(async () => {
        await cleanup(browser);
    });

    test('should send and display text message', async () => {
        await login(page, 'Alice');
        
        await sendMessage(page, 'Hello, SecChat!');
        
        // Verify message appears
        await waitForMessage(page, 'Hello, SecChat!');
        const messages = await getMessages(page);
        expect(messages.some(m => m.includes('Hello, SecChat!'))).toBe(true);
    });

    test('should display emoji picker and insert emoji', async () => {
        await login(page, 'Alice');
        
        // Click emoji button
        await page.click('.tool-btn');
        await sleep(300);
        
        // Verify emoji picker is visible
        const emojiPicker = await page.$('.emoji-picker');
        expect(emojiPicker).not.toBeNull();
        
        // Click an emoji
        await page.click('.emoji-item');
        await sleep(200);
        
        // Verify emoji is in input
        const inputValue = await page.$eval('.message-input', el => el.value);
        expect(inputValue.length).toBeGreaterThan(0);
    });

    test('should send long message without truncation', async () => {
        await login(page, 'Alice');
        
        const longMessage = 'A'.repeat(500);
        await sendMessage(page, longMessage);
        
        await waitForMessage(page, 'AAAAAAAAAA'); // Partial match
        const messages = await getMessages(page);
        const longMsg = messages.find(m => m && m.includes('AAAA'));
        expect(longMsg).toBeDefined();
        expect(longMsg.length).toBeGreaterThanOrEqual(500);
    });

    test('should show send button active when message typed', async () => {
        await login(page, 'Alice');
        
        // Button should be inactive initially
        let sendBtn = await page.$('.send-btn');
        let hasActive = await page.$eval('.send-btn', el => el.classList.contains('active'));
        expect(hasActive).toBe(false);
        
        // Type something
        const textarea = await page.$('.message-input');
        await textarea.type('Test');
        
        // Button should be active now
        hasActive = await page.$eval('.send-btn', el => el.classList.contains('active'));
        expect(hasActive).toBe(true);
    });
});
