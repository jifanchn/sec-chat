/**
 * E2E Tests: Avatar Functionality
 * 
 * Tests comprehensive avatar handling including:
 * - Default avatar fallback (initial letter)
 * - Setting avatar via upload in chat header
 * - Avatar display in members list and chat bubbles
 */
const path = require('path');
const { launchBrowser, login, sendMessage, sleep, cleanup, screenshot, attachLogger } = require('./helpers');

describe('Avatar Functionality', () => {
    let browser;
    let page;
    const TEST_IMAGE_PATH = path.resolve(__dirname, '../client/src/static/logo.png');

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
        attachLogger(page);
    });

    afterEach(async () => {
        await cleanup(browser);
    });

    async function loginToChat(page, nickname) {
        await login(page, nickname);
        await page.waitForSelector('.chat-page');
        await sleep(800);
    }

    /**
     * Helper to navigate to members page
     */
    async function goToMembersPage(page) {
        // chat header right: [avatar] [members] [logout]
        await page.click('.chat-header .header-right .icon-btn:nth-child(2)'); // Members icon 👥
        await page.waitForSelector('.members-page');
        await sleep(1000);
    }

    async function setAvatarByUpload(page, imagePath = TEST_IMAGE_PATH) {
        // Click avatar button and provide a file
        const [fileChooser] = await Promise.all([
            page.waitForFileChooser(),
            page.click('.chat-header .header-right .icon-btn:nth-child(1)'),
        ]);
        await fileChooser.accept([imagePath]);

        // Wait for backend updates to complete
        try {
            await page.waitForResponse(res => res.url().includes('/api/upload') && res.status() === 200, { timeout: 20000 });
            await page.waitForResponse(res => res.url().includes('/api/user/avatar') && res.status() === 200, { timeout: 20000 });
        } catch (e) {
            await screenshot(page, 'avatar_api_calls_missing');
            throw e;
        }

        // Wait for header avatar image to appear (H5 <image> -> <img>)
        try {
            await page.waitForSelector('.chat-header .header-right .icon-btn:nth-child(1) img', { timeout: 20000 });
        } catch (e) {
            await screenshot(page, 'avatar_set_failed');
            throw e;
        }
        await sleep(1000);
    }

    test('should use default avatar when none specified', async () => {
        await loginToChat(page, 'DefaultAvatarUser');

        // Go to Members page
        await goToMembersPage(page);

        // Self entry should render a text fallback avatar (no img)
        const selfHasImgAvatar = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.member-item'));
            const selfItem = items.find(el => (el.querySelector('.member-name')?.textContent || '').includes('(我)'));
            if (!selfItem) return null;
            return selfItem.querySelector('.member-avatar img') !== null;
        });

        if (selfHasImgAvatar === null) {
            await screenshot(page, 'members_self_not_found');
        }
        expect(selfHasImgAvatar).toBe(false);
    });

    test('should set avatar via upload and display in members list', async () => {
        await loginToChat(page, 'AvatarUser1');
        await setAvatarByUpload(page);

        await goToMembersPage(page);

        const selfAvatarSrc = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.member-item'));
            const selfItem = items.find(el => (el.querySelector('.member-name')?.textContent || '').includes('(我)'));
            const img = selfItem?.querySelector('.member-avatar img');
            return img ? img.getAttribute('src') : '';
        });

        if (!selfAvatarSrc) {
            await screenshot(page, 'members_avatar_missing');
        }
        expect(selfAvatarSrc).toContain('/uploads/');
    });

    test('should display avatar in chat message bubbles', async () => {
        await loginToChat(page, 'ChatAvatarUser');
        await setAvatarByUpload(page);

        await sendMessage(page, 'Testing avatar in message bubble');
        await sleep(1500);

        const avatarInChat = await page.evaluate(() => {
            // uni-app may not preserve class on <img>, so we just look for any <img> inside message-avatar
            const imgs = Array.from(document.querySelectorAll('.message-avatar img'));
            return imgs.map(i => i.getAttribute('src')).filter(Boolean);
        });

        if (!avatarInChat.length) {
            await screenshot(page, 'avatar_in_chat_missing');
        }
        // Should include our uploaded avatar url (served from backend uploads)
        expect(avatarInChat.some(src => src.includes('/uploads/'))).toBe(true);
    });
});
