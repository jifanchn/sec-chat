/**
 * E2E Tests: Login Flow
 */
const { launchBrowser, sleep, cleanup, BASE_URL, WS_URL, DEFAULT_PASSWORD } = require('./helpers');

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
        const serverInput = await page.$('.input-group:nth-child(1) .input-field');
        const passwordInput = await page.$('.input-group:nth-child(2) .input-field');
        const nicknameInput = await page.$('.input-group:nth-child(3) .input-field');
        const loginBtn = await page.$('.login-btn');
        
        expect(serverInput).not.toBeNull();
        expect(passwordInput).not.toBeNull();
        expect(nicknameInput).not.toBeNull();
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
        expect(errorText).toContain('server');
    });

    test('should login successfully with valid credentials', async () => {
        await page.goto(BASE_URL);
        await page.waitForSelector('.login-page');
        
        // Fill form
        const serverInput = await page.$('.input-group:nth-child(1) .input-field');
        await serverInput.click({ clickCount: 3 });
        await serverInput.type(WS_URL);
        
        const passwordInput = await page.$('.input-group:nth-child(2) .input-field');
        await passwordInput.type(DEFAULT_PASSWORD);
        
        const nicknameInput = await page.$('.input-group:nth-child(3) .input-field');
        await nicknameInput.type('TestUser');
        
        // Click login
        await page.click('.login-btn');
        
        // Wait for chat page
        await page.waitForSelector('.chat-page', { timeout: 10000 });
        
        // Verify header exists
        const header = await page.$('.header-title');
        expect(header).not.toBeNull();
    });

    test('should show error for invalid password', async () => {
        await page.goto(BASE_URL);
        await page.waitForSelector('.login-page');
        
        // Fill form with wrong password
        const serverInput = await page.$('.input-group:nth-child(1) .input-field');
        await serverInput.click({ clickCount: 3 });
        await serverInput.type(WS_URL);
        
        const passwordInput = await page.$('.input-group:nth-child(2) .input-field');
        await passwordInput.type('wrongpassword');
        
        const nicknameInput = await page.$('.input-group:nth-child(3) .input-field');
        await nicknameInput.type('TestUser');
        
        // Click login
        await page.click('.login-btn');
        await sleep(2000);
        
        // Should still be on login page with error
        const loginPage = await page.$('.login-page');
        expect(loginPage).not.toBeNull();
        
        const errorBox = await page.$('.error-box');
        expect(errorBox).not.toBeNull();
    });

    test('should cache credentials for next visit', async () => {
        await page.goto(BASE_URL);
        await page.waitForSelector('.login-page');
        
        // Fill server and nickname (these get cached)
        const serverInput = await page.$('.input-group:nth-child(1) .input-field');
        await serverInput.click({ clickCount: 3 });
        await serverInput.type(WS_URL);
        
        const nicknameInput = await page.$('.input-group:nth-child(3) .input-field');
        await nicknameInput.type('CachedUser');
        
        // Trigger caching by starting login (even if it fails)
        const passwordInput = await page.$('.input-group:nth-child(2) .input-field');
        await passwordInput.type(DEFAULT_PASSWORD);
        await page.click('.login-btn');
        await page.waitForSelector('.chat-page', { timeout: 10000 });
        
        // Now reload
        await page.goto(BASE_URL);
        await page.waitForSelector('.login-page');
        await sleep(500);
        
        // Check if server URL is pre-filled
        const cachedServer = await page.$eval('.input-group:nth-child(1) .input-field', el => el.value);
        expect(cachedServer).toBe(WS_URL);
    });
});
