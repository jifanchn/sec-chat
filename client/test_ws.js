const puppeteer = require('puppeteer');

async function test() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('[PAGE]', msg.text()));
    
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    
    // Test native WebSocket directly
    const wsResult = await page.evaluate(() => {
        return new Promise((resolve) => {
            console.log('[TEST] Trying native WebSocket...');
            const ws = new WebSocket('ws://localhost:8081/ws');
            
            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve({ success: false, error: 'timeout' });
                }
            }, 5000);
            
            ws.onopen = () => {
                console.log('[TEST] WebSocket opened!');
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ success: true });
                }
            };
            
            ws.onerror = (e) => {
                console.log('[TEST] WebSocket error:', e);
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve({ success: false, error: 'error' });
                }
            };
        });
    });
    
    console.log('[RESULT]', JSON.stringify(wsResult));
    
    await browser.close();
}

test().catch(console.error);
