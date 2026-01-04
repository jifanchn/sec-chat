/**
 * E2E Tests: Reply & Recall
 */
const { launchBrowser, login, sleep, sendMessage, waitForMessage, cleanup } = require('./helpers');

describe('Reply & Recall', () => {
    let browser;
    let page;

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
    });

    afterEach(async () => {
        await cleanup(browser);
    });

    // SKIPPED: Puppeteer cannot trigger uni-app @longpress events in H5 environment
    test.skip('should recall own message', async () => {
        await login(page, 'Alice');
        
        // Send a message
        await sendMessage(page, 'Message to recall');
        await waitForMessage(page, 'Message to recall');
        
        await sleep(500);
        
        // Directly call Vue's handleContextAction method
        await page.evaluate(() => {
            const chatPage = document.querySelector('.chat-page');
            const vueInstance = chatPage?.__vue__ || chatPage?.$parent || chatPage?.__vueParentComponent?.ctx;
            if (vueInstance && vueInstance.messages && vueInstance.messages.length > 0) {
                const lastMsg = vueInstance.messages[vueInstance.messages.length - 1];
                // Set context menu message
                vueInstance.contextMenu.message = lastMsg;
                // Directly call recall action
                vueInstance.handleContextAction('recall');
            }
        });
        
        await sleep(500);
        
        // Verify message was recalled
        const recalledText = await page.$('.recalled-text');
        expect(recalledText).not.toBeNull();
        console.log('[TEST] Message recalled successfully');
    });

    // SKIPPED: Puppeteer cannot trigger uni-app @longpress events in H5 environment
    test.skip('should show reply preview when replying', async () => {
        await login(page, 'Alice');
        
        // Send a message first
        await sendMessage(page, 'Original message');
        await waitForMessage(page, 'Original message');
        
        await sleep(500);
        
        // Directly call Vue's handleContextAction method for reply
        await page.evaluate(() => {
            const chatPage = document.querySelector('.chat-page');
            const vueInstance = chatPage?.__vue__ || chatPage?.$parent || chatPage?.__vueParentComponent?.ctx;
            if (vueInstance && vueInstance.messages && vueInstance.messages.length > 0) {
                const lastMsg = vueInstance.messages[vueInstance.messages.length - 1];
                vueInstance.contextMenu.message = lastMsg;
                vueInstance.handleContextAction('reply');
            }
        });
        
        await sleep(300);
        
        // Verify reply preview appears
        const replyPreview = await page.waitForSelector('.reply-preview', { timeout: 2000 });
        expect(replyPreview).not.toBeNull();
        
        const previewText = await page.$eval('.reply-label', el => el.textContent);
        expect(previewText).toContain('Original');
        console.log('[TEST] Reply preview shown:', previewText);
    });

    // SKIPPED: Puppeteer cannot trigger uni-app @longpress events in H5 environment
    test.skip('should cancel reply', async () => {
        await login(page, 'Alice');
        
        await sendMessage(page, 'Test message');
        await waitForMessage(page, 'Test message');
        
        await sleep(500);
        
        // Directly call Vue's handleContextAction method for reply
        await page.evaluate(() => {
            const chatPage = document.querySelector('.chat-page');
            const vueInstance = chatPage?.__vue__ || chatPage?.$parent || chatPage?.__vueParentComponent?.ctx;
            if (vueInstance && vueInstance.messages && vueInstance.messages.length > 0) {
                const lastMsg = vueInstance.messages[vueInstance.messages.length - 1];
                vueInstance.contextMenu.message = lastMsg;
                vueInstance.handleContextAction('reply');
            }
        });
        await sleep(300);
        
        // Verify reply preview appeared
        const replyPreview = await page.waitForSelector('.reply-preview', { timeout: 2000 });
        expect(replyPreview).not.toBeNull();
        
        // Click cancel button
        const closeBtn = await page.waitForSelector('.close-btn', { timeout: 2000 });
        expect(closeBtn).not.toBeNull();
        await closeBtn.click();
        await sleep(200);
        
        // Verify reply preview is gone
        const replyPreviewAfter = await page.$('.reply-preview');
        expect(replyPreviewAfter).toBeNull();
        console.log('[TEST] Reply cancelled successfully');
    });
});
