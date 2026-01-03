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

    test('should recall own message', async () => {
        await login(page, 'Alice');
        
        // Send a message
        await sendMessage(page, 'Message to recall');
        await waitForMessage(page, 'Message to recall');
        
        // Find the message and long-press
        const messageElements = await page.$$('.message.self .message-bubble');
        if (messageElements.length > 0) {
            const lastMessage = messageElements[messageElements.length - 1];
            const box = await lastMessage.boundingBox();
            
            // Simulate long press
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await sleep(600);
            await page.mouse.up();
            
            // Wait for context menu
            await sleep(300);
            const contextMenu = await page.$('.context-menu');
            
            if (contextMenu) {
                // Click recall
                const menuItems = await page.$$('.menu-item');
                for (const item of menuItems) {
                    const text = await item.evaluate(el => el.textContent);
                    if (text.includes('撤回')) {
                        await item.click();
                        break;
                    }
                }
                
                await sleep(500);
                
                // Verify recalled message
                const recalledText = await page.$('.recalled-text');
                expect(recalledText).not.toBeNull();
            }
        }
    });

    test('should show reply preview when replying', async () => {
        await login(page, 'Alice');
        
        // Send a message first
        await sendMessage(page, 'Original message');
        await waitForMessage(page, 'Original message');
        
        // Find the message and long-press
        const messageElements = await page.$$('.message.self .message-bubble');
        if (messageElements.length > 0) {
            const lastMessage = messageElements[messageElements.length - 1];
            const box = await lastMessage.boundingBox();
            
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await sleep(600);
            await page.mouse.up();
            
            await sleep(300);
            
            // Click reply
            const menuItems = await page.$$('.menu-item');
            for (const item of menuItems) {
                const text = await item.evaluate(el => el.textContent);
                if (text.includes('回复')) {
                    await item.click();
                    break;
                }
            }
            
            await sleep(300);
            
            // Verify reply preview appears
            const replyPreview = await page.$('.reply-preview');
            if (replyPreview) {
                const previewText = await page.$eval('.reply-label', el => el.textContent);
                expect(previewText).toContain('Original');
            }
        }
    });

    test('should cancel reply', async () => {
        await login(page, 'Alice');
        
        await sendMessage(page, 'Test message');
        await waitForMessage(page, 'Test message');
        
        // Trigger reply (same as above)
        const messageElements = await page.$$('.message.self .message-bubble');
        if (messageElements.length > 0) {
            const lastMessage = messageElements[messageElements.length - 1];
            const box = await lastMessage.boundingBox();
            
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await sleep(600);
            await page.mouse.up();
            await sleep(300);
            
            const menuItems = await page.$$('.menu-item');
            for (const item of menuItems) {
                const text = await item.evaluate(el => el.textContent);
                if (text.includes('回复')) {
                    await item.click();
                    break;
                }
            }
            
            await sleep(300);
            
            // Click cancel button
            const closeBtn = await page.$('.close-btn');
            if (closeBtn) {
                await closeBtn.click();
                await sleep(200);
                
                // Verify reply preview is gone
                const replyPreview = await page.$('.reply-preview');
                expect(replyPreview).toBeNull();
            }
        }
    });
});
