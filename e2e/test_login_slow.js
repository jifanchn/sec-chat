const puppeteer = require('puppeteer');

async function test() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('[PAGE]', msg.text()));
    page.on('pageerror', err => console.error('[ERROR]', err.message));
    
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    await sleep(2000);
    
    // Login with 127.0.0.1
    console.log('[TEST] Filling form...');
    await page.click('.input-group:nth-child(1) .input-field');
    await sleep(200);
    await page.keyboard.type('ws://127.0.0.1:8081/ws');
    await sleep(200);
    
    await page.click('.input-group:nth-child(2) .input-field');
    await sleep(200);
    await page.keyboard.type('test123');
    await sleep(200);
    
    await page.click('.input-group:nth-child(3) .input-field');
    await sleep(200);
    await page.keyboard.type('Alice');
    await sleep(500);
    
    console.log('[TEST] Clicking login button...');
    await page.click('.login-btn');
    
    console.log('[TEST] Waiting for response...');
    await sleep(5000);
    
    // Check current state
    const state = await page.evaluate(() => {
        return {
            hasChatPage: document.querySelector('.chat-page') !== null,
            hasLoginPage: document.querySelector('.login-page') !== null,
            hasError: document.querySelector('.error-box') !== null,
            errorText: document.querySelector('.error-box')?.textContent || '',
            url: window.location.href
        };
    });
    
    console.log('[TEST] State:', JSON.stringify(state, null, 2));
    
    if (state.hasChatPage) {
        console.log('[TEST] SUCCESS: Login worked!');
        await sleep(3000);
        await browser.close();
        process.exit(0);
    } else if (state.hasError) {
        console.log('[TEST] Error:', state.errorText);
        await browser.close();
        process.exit(1);
    } else {
        console.log('[TEST] Still waiting...');
        await sleep(5000);
        
        const state2 = await page.evaluate(() => {
            return {
                hasChatPage: document.querySelector('.chat-page') !== null,
                hasLoginPage: document.querySelector('.login-page') !== null,
                hasError: document.querySelector('.error-box') !== null,
                url: window.location.href
            };
        });
        console.log('[TEST] State after 5s:', JSON.stringify(state2, null, 2));
        
        await browser.close();
        process.exit(state2.hasChatPage ? 0 : 1);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test().catch(err => {
    console.error('[TEST] Exception:', err);
    process.exit(1);
});
