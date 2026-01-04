const puppeteer = require('puppeteer');

async function test() {
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--disable-web-security', '--allow-running-insecure-content']
    });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('[PAGE]', msg.text()));
    page.on('pageerror', err => console.error('[ERROR]', err.message));
    
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    
    // Login
    await page.click('.input-group:nth-child(1) .input-field');
    await page.type('.input-group:nth-child(1) .input-field', 'ws://localhost:8081/ws');
    await page.click('.input-group:nth-child(2) .input-field');
    await page.type('.input-group:nth-child(2) .input-field', 'test123');
    await page.click('.input-group:nth-child(3) .input-field');
    await page.type('.input-group:nth-child(3) .input-field', 'Alice');
    await page.click('.login-btn');
    
    console.log('[TEST] Waiting for chat page or error...');
    
    // Wait for either chat page or error box
    await Promise.race([
        page.waitForSelector('.chat-page', { timeout: 15000 }),
        page.waitForSelector('.error-box', { timeout: 15000 })
    ]);
    
    const hasChat = await page.$('.chat-page') !== null;
    const hasError = await page.$('.error-box') !== null;
    
    console.log('[TEST] Result: chatPage=' + hasChat + ', errorBox=' + hasError);
    
    if (hasError) {
        const errorText = await page.$eval('.error-text', el => el.textContent);
        console.log('[TEST] Error message:', errorText);
    }
    
    await sleep(3000);
    await browser.close();
    
    if (hasChat) {
        console.log('[TEST] SUCCESS: Login worked!');
        process.exit(0);
    } else {
        console.log('[TEST] FAILED: Login failed');
        process.exit(1);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test().catch(err => {
    console.error('[TEST] Exception:', err);
    process.exit(1);
});
