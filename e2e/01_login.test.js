/**
 * E2E Tests: Login Flow
 */
const { launchBrowser, sleep, cleanup, login, BASE_URL } = require('./helpers');

describe('Login Flow', () => {
    let browser;
    let page;

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
    });

    afterEach(async () => {
        await cleanup(browser);
    });

    test('should display login page with all fields', async () => {
        await page.goto(BASE_URL);
        await page.waitForSelector('.login-page');
        
        // Verify all input fields exist
        const inputs = await page.$$('.input-group input');
        const loginBtn = await page.$('.login-btn');
        
        expect(inputs.length).toBeGreaterThanOrEqual(3);
        expect(loginBtn).not.toBeNull();
    });

    test('should show error for empty fields', async () => {
        await page.goto(BASE_URL);
        await page.waitForSelector('.login-page');
        
        // Click login without filling anything
        await page.click('.login-btn');
        await sleep(500);
        
        // Should show error
        const errorBox = await page.$('.error-box');
        expect(errorBox).not.toBeNull();
        
        const errorText = await page.$eval('.error-text', el => el.textContent);
        // App 会自动填充默认 serverUrl（同域 /ws），因此第一个缺失字段通常是 password
        expect(errorText.toLowerCase()).toContain('password');
    });

    test('should login successfully with valid credentials', async () => {
        await login(page, 'TestUser');

        // Verify header exists
        const header = await page.$('.header-title');
        expect(header).not.toBeNull();
    });

    test('should show error for invalid password', async () => {
        await expect(login(page, 'TestUser', 'wrongpassword')).rejects.toThrow(/Login (failed|stuck)/i);

        // Should still be on login page (not redirected to chat)
        const loginPage = await page.$('.login-page');
        expect(loginPage).not.toBeNull();
    });

    test('should cache credentials for next visit', async () => {
        await login(page, 'CachedUser');
        
        // Verify we're on chat page
        await page.waitForSelector('.chat-page');

        // Verify cache was saved (object exists in localStorage)
        const savedCache = await page.evaluate(() => {
            const data = localStorage.getItem('secChat_login');
            return data ? JSON.parse(data) : null;
        });
        
        expect(savedCache).not.toBeNull();
        expect(typeof savedCache).toBe('object');
        console.log('[TEST] Cache saved after login:', savedCache);

        // Reload page and verify cache persists
        await page.goto(BASE_URL);
        await page.waitForSelector('.login-page');
        await sleep(1000);

        // Verify cache still exists in localStorage after reload
        const reloadedCache = await page.evaluate(() => {
            const data = localStorage.getItem('secChat_login');
            return data ? JSON.parse(data) : null;
        });
        
        expect(reloadedCache).not.toBeNull();
        expect(typeof reloadedCache).toBe('object');
        console.log('[TEST] Cache persisted after reload:', reloadedCache);
    });
});
