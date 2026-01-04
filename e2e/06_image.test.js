/**
 * E2E Tests: Image Upload and Download
 */
const path = require('path');
const { launchBrowser, login, sleep, cleanup, screenshot, uploadImage, waitForImageMessage, createWSClient } = require('./helpers');

describe('Image Upload and Download', () => {
    let browser;
    let page;
    const TEST_IMAGE_PATH = path.resolve(__dirname, '../client/src/static/logo.png');

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
    });

    afterEach(async () => {
        await cleanup(browser);
    });

    test('should upload image and display in chat', async () => {
        await login(page, 'Alice');
        
        // Upload image
        await uploadImage(page, TEST_IMAGE_PATH);
        
        // Wait for image message to appear
        await waitForImageMessage(page, 15000);
        
        // Verify image element exists with valid src
        const imageData = await page.evaluate(() => {
            const imageBubbles = document.querySelectorAll('.message-bubble.image');
            for (const bubble of imageBubbles) {
                const img = bubble.querySelector('img');  // uni-app renders <image> as <img> in H5
                if (img && img.getAttribute('src')) {
                    return {
                        src: img.getAttribute('src'),
                        hasBlobUrl: img.getAttribute('src').startsWith('blob:')
                    };
                }
            }
            return null;
        });
        
        expect(imageData).not.toBeNull();
        // Image src should be a blob URL (decrypted)
        expect(imageData.hasBlobUrl).toBe(true);
        console.log('[TEST] Image uploaded and displayed successfully');
        
        await screenshot(page, 'image_upload_success');
    });

    test('should show image to other users', async () => {
        // First user uploads image
        await login(page, 'Charlie');
        await uploadImage(page, TEST_IMAGE_PATH);
        await waitForImageMessage(page, 15000);

        // Give time for message to be saved to server
        await sleep(3000);

        // Create a new browser instance for the second user to avoid conflicts
        const browser2 = await launchBrowser();
        const page2 = await browser2.newPage();
        await login(page2, 'Dave');

        // Wait for messages to load (including history)
        await sleep(5000);

        // Check if Dave can see Charlie's image
        const daveSeesImage = await page2.evaluate(() => {
            const imageBubbles = document.querySelectorAll('.message-bubble.image');
            return imageBubbles.length > 0;
        });

        expect(daveSeesImage).toBe(true);
        console.log('[TEST] Second user can see image message');

        await screenshot(page2, 'image_visible_to_others');
        await cleanup(browser2);
    });

    test('should click to preview image', async () => {
        await login(page, 'Alice');
        await uploadImage(page, TEST_IMAGE_PATH);
        await waitForImageMessage(page, 15000);
        
        // Click on the image to preview
        await page.click('.message-bubble.image img');  // uni-app renders <image> as <img> in H5
        await sleep(1000);
        
        // uni.previewImage creates a native preview - in H5 it may create an overlay
        // Just verify click doesn't error
        console.log('[TEST] Image click preview completed without error');
    });
});
