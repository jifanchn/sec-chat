const puppeteer = require('puppeteer');
const path = require('path');

const TEST_IMAGE = path.resolve(__dirname, '../client/src/static/logo.png');

async function test() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('[PAGE]', msg.text()));
    page.on('request', req => {
        if (req.url().includes('/api/upload')) {
            console.log('[UPLOAD]', req.url(), req.method());
        }
    });
    
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    
    // Login
    await page.click('.input-group:nth-child(1) .input-field');
    await page.type('.input-group:nth-child(1) .input-field', 'ws://127.0.0.1:8081/ws');
    await page.click('.input-group:nth-child(2) .input-field');
    await page.type('.input-group:nth-child(2) .input-field', 'test123');
    await page.click('.input-group:nth-child(3) .input-field');
    await page.type('.input-group:nth-child(3) .input-field', 'Alice');
    await page.click('.login-btn');
    
    // Wait for chat page
    await page.waitForSelector('.chat-page', { timeout: 15000 });
    console.log('[TEST] Logged in, waiting 3s...');
    await sleep(3000);
    
    // Check if there's a file input
    const beforeInput = await page.evaluate(() => {
        return document.querySelectorAll('input[type="file"]').length;
    });
    console.log('[TEST] File inputs before click:', beforeInput);
    
    // Click camera button
    console.log('[TEST] Clicking camera button...');
    
    // Intercept file chooser
    let fileChooserTriggered = false;
    page.on('filechooser', () => {
        fileChooserTriggered = true;
        console.log('[TEST] File chooser event triggered!');
    });
    
    try {
        await page.click('.tool-btn:nth-child(2)');
    } catch (e) {
        console.log('[TEST] Click error:', e.message);
    }
    
    await sleep(2000);
    
    const afterInput = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="file"]');
        return {
            count: inputs.length,
            details: Array.from(inputs).map(i => ({
                style: i.style.cssText,
                visible: i.offsetParent !== null,
                accept: i.accept
            }))
        };
    });
    console.log('[TEST] File inputs after click:', JSON.stringify(afterInput));
    console.log('[TEST] File chooser triggered:', fileChooserTriggered);
    
    // If file input exists, try to set file directly
    if (afterInput.count > 0) {
        console.log('[TEST] Setting file directly...');
        const input = await page.$('input[type="file"]');
        if (input) {
            await input.uploadFile(TEST_IMAGE);
            console.log('[TEST] File uploaded via input');
        }
    }
    
    // Wait for upload
    await sleep(8000);
    
    // Check for image message
    const imageFound = await page.evaluate(() => {
        const imageBubbles = document.querySelectorAll('.message-bubble.image');
        if (imageBubbles.length > 0) {
            const img = imageBubbles[0].querySelector('img');
            return {
                hasImageBubble: true,
                count: imageBubbles.length,
                hasImg: img !== null,
                imgSrc: img?.src || ''
            };
        }
        return { hasImageBubble: false };
    });
    console.log('[TEST] Image check:', JSON.stringify(imageFound));
    
    await sleep(3000);
    await browser.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test().catch(console.error);
