const puppeteer = require('puppeteer');

async function debug() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Go to login page
    await page.goto('http://localhost:5174');
    await page.waitForSelector('.input-field');
    
    // Login
    await page.click('.input-group:nth-child(1) .input-field');
    await page.keyboard.type('ws://localhost:8081/ws');
    await page.click('.input-group:nth-child(2) .input-field');
    await page.keyboard.type('test123');
    await page.click('.input-group:nth-child(3) .input-field');
    await page.keyboard.type('Alice');
    await page.click('.login-btn');
    
    await page.waitForSelector('.chat-page', { timeout: 10000 });
    await sleep(2000);
    
    // Check what elements exist
    const elements = await page.evaluate(() => {
        const result = {
            messageBubbles: document.querySelectorAll('.message-bubble').length,
            imageBubbles: document.querySelectorAll('.message-bubble.image').length,
            images: document.querySelectorAll('.message-bubble.image image').length,
            imgs: document.querySelectorAll('.message-bubble.image img').length,
            allImages: document.querySelectorAll('image').length,
            allImgs: document.querySelectorAll('img').length,
            innerHTML: ''
        };
        
        const imageBubble = document.querySelector('.message-bubble.image');
        if (imageBubble) {
            result.innerHTML = imageBubble.innerHTML;
        }
        
        return result;
    });
    
    console.log('Elements found:', JSON.stringify(elements, null, 2));
    
    // Take screenshot
    await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
    
    await browser.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

debug().catch(console.error);
