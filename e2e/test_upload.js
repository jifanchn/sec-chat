const puppeteer = require('puppeteer');
const path = require('path');

const TEST_IMAGE = path.resolve(__dirname, '../sec-chat/client/src/static/logo.png');

async function run() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Listen for all network requests
    page.on('request', req => {
        const url = req.url();
        if (url.includes('/api/upload') || url.includes('/upload')) {
            console.log('[UPLOAD REQUEST]', url, req.method());
        }
    });
    
    page.on('console', msg => console.log('[PAGE]', msg.text()));
    
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    
    // Login
    await page.click('.input-group:nth-child(1) .input-field');
    await page.type('.input-group:nth-child(1) .input-field', 'ws://localhost:8081/ws');
    await page.click('.input-group:nth-child(2) .input-field');
    await page.type('.input-group:nth-child(2) .input-field', 'test123');
    await page.click('.input-group:nth-child(3) .input-field');
    await page.type('.input-group:nth-child(3) .input-field', 'Alice');
    await page.click('.login-btn');
    
    await page.waitForSelector('.chat-page', { timeout: 15000 });
    console.log('[OK] Logged in');
    await sleep(3000);
    
    // Check tool buttons
    const toolBtns = await page.evaluate(() => {
        const btns = document.querySelectorAll('.tool-btn');
        return Array.from(btns).map((b, i) => ({
            index: i,
            text: b.textContent,
            onclick: b.getAttribute('onclick') || b.onclick?.toString?.() || 'no handler'
        }));
    });
    console.log('[TOOL BTNS]', JSON.stringify(toolBtns, null, 2));
    
    // Try clicking camera button
    console.log('[CLICK] Clicking camera button...');
    
    // Intercept file chooser
    let fileChooserSeen = false;
    page.on('filechooser', () => {
        fileChooserSeen = true;
        console.log('[FILECHOOSER] File chooser detected!');
    });
    
    try {
        await page.click('.tool-btn:nth-child(2)');
        console.log('[CLICK] Button clicked, fileChooserSeen:', fileChooserSeen);
    } catch (e) {
        console.log('[ERROR] Click failed:', e.message);
    }
    
    await sleep(5000);
    
    // Check if file input was created
    const hasFileInput = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="file"]');
        return {
            count: inputs.length,
            details: Array.from(inputs).map(i => ({
                style: i.style.cssText,
                visible: i.offsetParent !== null
            }))
        };
    });
    console.log('[FILE INPUT]', JSON.stringify(hasFileInput));
    
    await browser.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

run().catch(console.error);
