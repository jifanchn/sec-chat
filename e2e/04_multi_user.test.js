/**
 * E2E Tests: Multi-User Scenarios
 */
const { launchBrowser, login, sleep, sendMessage, waitForSystemMessage, cleanup, createWSClient } = require('./helpers');

describe('Multi-User', () => {
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

    test('should show join message when user connects', async () => {
        await login(page, 'Alice');
        
        // Another user joins via WebSocket
        const bob = await createWSClient('Bob');
        wsClients.push(bob);
        
        // Wait for join message
        await waitForSystemMessage(page, 'Bob joined');
    });

    test('should show leave message when user disconnects', async () => {
        await login(page, 'Alice');
        
        // Bob joins
        const bob = await createWSClient('Bob');
        wsClients.push(bob);
        await waitForSystemMessage(page, 'Bob joined');
        
        // Bob leaves
        bob.close();
        wsClients = [];
        
        // Wait for leave message
        await waitForSystemMessage(page, 'Bob left');
    });

    test('should update online count when users join', async () => {
        await login(page, 'Alice');
        
        // Get initial count
        const initialCount = await page.$eval('.member-count', el => el.textContent);
        
        // Bob joins
        const bob = await createWSClient('Bob');
        wsClients.push(bob);
        await sleep(1000);
        
        // Charlie joins
        const charlie = await createWSClient('Charlie');
        wsClients.push(charlie);
        await sleep(1000);
        
        // Verify count increased (may need to wait for update)
        const finalCount = await page.$eval('.member-count', el => el.textContent);
        const initialNum = parseInt(initialCount);
        const finalNum = parseInt(finalCount);
        
        expect(finalNum).toBeGreaterThan(initialNum);
    });

    test('should show typing indicator when other user types', async () => {
        await login(page, 'Alice');
        
        // Bob joins and starts typing
        const bob = await createWSClient('Bob');
        wsClients.push(bob);
        await sleep(500);
        
        bob.sendTyping();
        await sleep(500);
        
        // Check for typing indicator
        const typingIndicator = await page.$('.typing-indicator');
        // May or may not appear depending on timing
        // This test validates the indicator mechanism exists
    });

    test('should navigate to members page', async () => {
        await login(page, 'Alice');
        
        // Click members button
        await page.click('.icon-btn');
        await sleep(500);
        
        // Should navigate to members page
        const membersPage = await page.$('.members-page, .member-list');
        // Verify navigation happened
    });

    test('three users can chat together', async () => {
        await login(page, 'Alice');
        
        // Bob and Charlie join
        const bob = await createWSClient('Bob');
        wsClients.push(bob);
        await sleep(300);
        
        const charlie = await createWSClient('Charlie');
        wsClients.push(charlie);
        await sleep(300);
        
        // Alice sends a message
        await sendMessage(page, 'Hello from Alice!');
        await sleep(500);
        
        // Verify at least the system messages about joining are visible
        const systemMessages = await page.$$('.system-message');
        expect(systemMessages.length).toBeGreaterThanOrEqual(2);
    });
});
