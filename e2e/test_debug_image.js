const puppeteer = require('puppeteer');
const path = require('path');

const TEST_IMAGE = path.resolve(__dirname, '../client/src/static/logo.png');

async function test() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('[PAGE]', msg.text()));
    page.on('request', req => {
        if (req.url().includes('/api/upload')) console.log('[REQ] UPLOAD:', req.method());
        if (req.url().includes('/uploads/')) console.log('[REQ] DOWNLOAD:', req.url());
    });
    
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    await sleep(3000);
    
    // Login with delays
    console.log('[TEST] Filling login form...');
    await page.click('.input-group:nth-child(1) .input-field');
    await sleep(300);
    await page.evaluate(() => document.querySelector('.input-group:nth-child(1) .input-field').value = '');
    await page.type('.input-group:nth-child(1) .input-field', 'ws://127.0.0.1:8081/ws', { delay: 50 });
    await sleep(300);
    
    await page.click('.input-group:nth-child(2) .input-field');
    await sleep(300);
    await page.type('.input-group:nth-child(2) .input-field', 'test123', { delay: 50 });
    await sleep(300);
    
    await page.click('.input-group:nth-child(3) .input-field');
    await sleep(300);
    await page.type('.input-group:nth-child(3) .input-field', 'TestUser', { delay: 50 });
    await sleep(500);
    
    console.log('[TEST] Clicking login...');
    await page.click('.login-btn');
    
    console.log('[TEST] Waiting for chat page...');
    await page.waitForSelector('.chat-page', { timeout: 20000 });
    console.log('[TEST] On chat page!');
    
    await sleep(5000);
    
    // Upload image
    console.log('[TEST] Uploading image...');
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('.tool-btn:nth-child(2)')
    ]);
    await fileChooser.accept([TEST_IMAGE]);
    console.log('[TEST] File selected');
    
    await sleep(10000);
    
    // Check page state
    const state = await page.evaluate(() => {
        const messageBubbles = document.querySelectorAll('.message-bubble');
        const imageBubbles = document.querySelectorAll('.message-bubble.image');
        const allImgs = document.querySelectorAll('img');
        const bubbleImgs = document.querySelectorAll('.message-bubble img');
        
        return {
            messageBubbles: messageBubbles.length,
            imageBubbles: imageBubbles.length,
            allImgs: allImgs.length,
            bubbleImgs: bubbleImgs.length,
            bubbleClasses: Array.from(messageBubbles).map(b => b.className),
            imgSrcs: Array.from(bubbleImgs).map(i => ({ src: i.src?.substring(0, 50), hasSrc: !!i.src }))
        };
    });
    
    console.log('[TEST] Page state:', JSON.stringify(state, null, 2));
    
    if (state.bubbleImgs > 0) {
        console.log('[TEST] SUCCESS: Image found!');
    } else {
        console.log('[TEST] FAILED: No image found');
    }
    
    await sleep(3000);
    await browser.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test().catch(console.error);
