const puppeteer = require('puppeteer');
const path = require('path');

const TEST_IMAGE = path.resolve(__dirname, '../client/src/static/logo.png');

async function run() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('[PAGE]', msg.text()));
    page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));
    
    // 1. Go to login
    console.log('[1] Navigating to login page...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    
    // 2. Login
    console.log('[2] Logging in as Alice...');
    await page.click('.input-group:nth-child(1) .input-field');
    await page.type('.input-group:nth-child(1) .input-field', 'ws://localhost:8081/ws');
    await page.click('.input-group:nth-child(2) .input-field');
    await page.type('.input-group:nth-child(2) .input-field', 'test123');
    await page.click('.input-group:nth-child(3) .input-field');
    await page.type('.input-group:nth-child(3) .input-field', 'Alice');
    await page.click('.login-btn');
    
    // Wait for chat page
    await page.waitForSelector('.chat-page', { timeout: 15000 });
    console.log('[3] Logged in, on chat page');
    await sleep(3000);
    
    // 3. Check initial state
    const initialState = await page.evaluate(() => {
        return {
            messageCount: document.querySelectorAll('.message-bubble').length,
            imageCount: document.querySelectorAll('.message-bubble.image').length,
            imgTags: document.querySelectorAll('.message-bubble img').length,
            imageTags: document.querySelectorAll('.message-bubble image').length
        };
    });
    console.log('[4] Initial state:', initialState);
    
    // 4. Upload image
    console.log('[5] Uploading image:', TEST_IMAGE);
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('.tool-btn:nth-child(2)')
    ]);
    await fileChooser.accept([TEST_IMAGE]);
    console.log('[6] File chooser accepted, waiting for upload...');
    
    // Wait for upload and message
    await sleep(8000);
    
    // 5. Check final state
    const finalState = await page.evaluate(() => {
        const bubbles = document.querySelectorAll('.message-bubble');
        const imageBubbles = document.querySelectorAll('.message-bubble.image');
        const imgs = document.querySelectorAll('.message-bubble.image img');
        const imageTags = document.querySelectorAll('.message-bubble.image image');
        
        const result = {
            messageCount: bubbles.length,
            imageBubbleCount: imageBubbles.length,
            imgCount: imgs.length,
            imageTagCount: imageTags.length
        };
        
        if (imgs.length > 0) {
            result.firstImgSrc = imgs[0].getAttribute('src');
        }
        if (imageBubbles.length > 0) {
            result.firstImageBubbleHTML = imageBubbles[0].innerHTML.substring(0, 300);
        }
        
        return result;
    });
    console.log('[7] Final state:', finalState);
    
    // 6. Screenshot
    await page.screenshot({ path: 'test_image_result.png', fullPage: true });
    console.log('[8] Screenshot saved to test_image_result.png');
    
    await browser.close();
    
    if (finalState.imgCount > 0) {
        console.log('SUCCESS: Image uploaded and displayed!');
    } else {
        console.log('FAILED: Image not found in chat');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
