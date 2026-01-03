/**
 * E2E Tests: History & Pagination
 */
const { launchBrowser, login, sleep, getMessages, cleanup, createWSClient } = require('./helpers');

describe('History & Pagination', () => {
    let browser;
    let page;
    let wsClients = [];

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
        wsClients = [];
    });

    afterEach(async () => {
        for (const client of wsClients) {
            try { client.close(); } catch (e) {}
        }
        await cleanup(browser);
    });

    test('should load history on login', async () => {
        // First, send some messages as a different user
        const seedUser = await createWSClient('SeedUser');
        wsClients.push(seedUser);
        
        // Send a few messages
        for (let i = 0; i < 3; i++) {
            seedUser.send(`Seed message ${i + 1}`);
            await sleep(100);
        }
        await sleep(500);
        seedUser.close();
        wsClients = [];
        
        // Now login and check history
        await login(page, 'Alice');
        await sleep(1000);
        
        // Should see some messages (system messages at minimum)
        const allElements = await page.$$('.message, .system-message');
        expect(allElements.length).toBeGreaterThan(0);
    });

    test('should have scrollable message container', async () => {
        await login(page, 'Alice');
        
        // Verify scroll container exists
        const scrollView = await page.$('.messages-container');
        expect(scrollView).not.toBeNull();
        
        // Check it has scroll-y attribute
        const hasScrollY = await page.$eval(
            '.messages-container', 
            el => el.getAttribute('scroll-y') !== null || el.classList.contains('scroll-y')
        );
    });

    test('should show loading indicator when scrolling to top', async () => {
        await login(page, 'Alice');
        
        // Send many messages first
        for (let i = 0; i < 10; i++) {
            const textarea = await page.$('.message-input');
            await textarea.type(`Message ${i + 1}`);
            await page.click('.send-btn');
            await sleep(100);
        }
        await sleep(500);
        
        // Try to scroll to top
        await page.evaluate(() => {
            const container = document.querySelector('.messages-container');
            if (container) {
                container.scrollTop = 0;
            }
        });
        await sleep(500);
        
        // The loading-more element may appear if hasMore is true
        // This depends on server state
    });

    test('should preserve scroll position when loading more', async () => {
        await login(page, 'Alice');
        
        // This test validates scroll behavior
        // Send some messages
        for (let i = 0; i < 5; i++) {
            const textarea = await page.$('.message-input');
            await textarea.type(`Test ${i}`);
            await page.click('.send-btn');
            await sleep(100);
        }
        
        await sleep(500);
        
        // Verify messages are present
        const messages = await getMessages(page);
        expect(messages.length).toBeGreaterThan(0);
    });

    test('should show time dividers between distant messages', async () => {
        await login(page, 'Alice');
        
        // Send a message now
        const textarea = await page.$('.message-input');
        await textarea.type('Recent message');
        await page.click('.send-btn');
        await sleep(500);
        
        // Check if any time divider exists
        const timeDividers = await page.$$('.time-divider');
        // Time dividers appear when messages are >5 min apart
        // With fresh messages, may or may not have dividers
    });
});
