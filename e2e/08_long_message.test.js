/**
 * E2E Tests: Long Message Support
 * 
 * Tests comprehensive handling of long messages including:
 * - Standard long messages (2000+ chars)
 * - Very long messages (5000+ chars)
 * - Multi-line formatted messages
 * - Special characters and emoji in long messages
 */
const { launchBrowser, login, sleep, getMessages, cleanup, screenshot, createWSClient } = require('./helpers');

describe('Long Message Support', () => {
    let browser;
    let page;

    beforeEach(async () => {
        browser = await launchBrowser();
        page = await browser.newPage();
    });

    afterEach(async () => {
        await cleanup(browser);
    });

    /**
     * For very long strings, directly typing into uni-app textarea can be flaky.
     * We send via a raw WebSocket client (same encryption as client) and verify UI renders it.
     */
    async function sendLongMessageViaWS(text) {
        const sender = await createWSClient('LongMsgSender');
        try {
            await sender.send(text);
        } finally {
            try { sender.close(); } catch (e) {}
        }
        // Give UI a bit of time to receive + decrypt + render
        await sleep(1500);
    }

    /**
     * Helper to verify a message with specific markers exists
     */
    async function verifyMessageWithMarkers(page, startMarker, endMarker, minLength, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const messages = await getMessages(page);
            const match = messages.find(m => 
                m.includes(startMarker) && 
                m.includes(endMarker) &&
                m.length >= minLength
            );
            
            if (match) {
                console.log('[TEST] Found matching message:', {
                    length: match.length,
                    minExpected: minLength,
                    hasStart: match.includes(startMarker),
                    hasEnd: match.includes(endMarker)
                });
                return true;
            }
            await sleep(500);
        }
        return false;
    }

    test('should send and display 2500 char message', async () => {
        await login(page, 'LongMsgTester1');

        // Create a long message > 2000 chars
        const base = 'Long message test block. ';
        // 25 chars per block. 100 blocks = 2500 chars.
        const longMessage = base.repeat(100) + 'END'; 
        
        console.log('[TEST] Generated message length:', longMessage.length);
        expect(longMessage.length).toBeGreaterThan(2000);

        await sendLongMessageViaWS(longMessage);

        const found = await verifyMessageWithMarkers(
            page, 
            longMessage.substring(0, 50), 
            'END', 
            longMessage.length - 100,
            20000
        );

        if (!found) {
            await screenshot(page, 'long_message_2500_failed');
        }

        expect(found).toBe(true);
    });

    test('should send and display very long message (5000+ chars)', async () => {
        await login(page, 'LongMsgTester2');

        // Create a very long message > 5000 chars
        const base = 'This is a very long test message segment with multiple words. ';
        // 62 chars per block. 85 blocks = 5270 chars.
        const veryLongMessage = 'START-5K ' + base.repeat(85) + ' END-5K'; 
        
        console.log('[TEST] Generated very long message length:', veryLongMessage.length);
        expect(veryLongMessage.length).toBeGreaterThan(5000);

        await sendLongMessageViaWS(veryLongMessage);

        const found = await verifyMessageWithMarkers(
            page, 
            'START-5K', 
            'END-5K', 
            5000,
            25000
        );

        if (!found) {
            await screenshot(page, 'very_long_message_5k_failed');
        }

        expect(found).toBe(true);
    });

    test('should handle multi-line long messages with formatting', async () => {
        await login(page, 'LongMsgTester3');

        // Create a multi-line formatted message
        const lines = [];
        lines.push('=== MULTI-LINE LONG MESSAGE TEST ===');
        lines.push('');
        for (let i = 1; i <= 50; i++) {
            lines.push(`Line ${i}: This is a test line with some content to make it reasonably long.`);
        }
        lines.push('');
        lines.push('=== END OF MESSAGE ===');
        
        const multiLineMessage = lines.join('\n');
        
        console.log('[TEST] Generated multi-line message:', {
            length: multiLineMessage.length,
            lineCount: lines.length
        });
        expect(multiLineMessage.length).toBeGreaterThan(2000);

        await sendLongMessageViaWS(multiLineMessage);

        const found = await verifyMessageWithMarkers(
            page, 
            '=== MULTI-LINE LONG MESSAGE TEST ===', 
            '=== END OF MESSAGE ===', 
            2000,
            25000
        );

        if (!found) {
            await screenshot(page, 'multiline_long_message_failed');
        }

        expect(found).toBe(true);
    });

    test('should handle long messages with special characters and emoji', async () => {
        await login(page, 'LongMsgTester4');

        // Create message with special characters and emoji
        const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
        const emoji = '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗☺️😚😙';
        const base = `Special chars: ${specialChars} Emoji: ${emoji} Normal text. `;
        // Create a long message with these patterns
        const specialMessage = 'START-SPECIAL ' + base.repeat(40) + ' END-SPECIAL';
        
        console.log('[TEST] Generated special char message length:', specialMessage.length);
        expect(specialMessage.length).toBeGreaterThan(2000);

        await sendLongMessageViaWS(specialMessage);

        const found = await verifyMessageWithMarkers(
            page, 
            'START-SPECIAL', 
            'END-SPECIAL', 
            2000,
            25000
        );

        if (!found) {
            await screenshot(page, 'special_chars_long_message_failed');
        }

        expect(found).toBe(true);
    });

    test('should handle repeated emoji in long message', async () => {
        await login(page, 'LongMsgTester5');

        // Create a message with lots of emoji
        const emojiPattern = '🚀💻🔥✨🎉👍💡🌟⭐🎯';
        const longEmojiMessage = 'EMOJI-START ' + emojiPattern.repeat(200) + ' EMOJI-END';
        
        console.log('[TEST] Generated emoji message length:', longEmojiMessage.length);
        expect(longEmojiMessage.length).toBeGreaterThan(2000);

        await sendLongMessageViaWS(longEmojiMessage);

        const found = await verifyMessageWithMarkers(
            page, 
            'EMOJI-START', 
            'EMOJI-END', 
            2000,
            25000
        );

        if (!found) {
            await screenshot(page, 'emoji_long_message_failed');
        }

        expect(found).toBe(true);
    });

    test('should display long message without truncation in UI', async () => {
        await login(page, 'LongMsgTester6');

        const uniqueId = 'UNIQUE-' + Date.now();
        const base = 'Testing UI rendering ';
        const testMessage = uniqueId + ' ' + base.repeat(150) + ' ' + uniqueId;
        
        console.log('[TEST] Testing UI rendering for message length:', testMessage.length);

        await sendLongMessageViaWS(testMessage);

        // Wait for message to appear
        await sleep(2000);

        // Verify that the full message is present (not truncated)
        const messages = await getMessages(page);
        const messageText = messages.find(m => m && m.includes(uniqueId)) || null;
        expect(messageText).toBeTruthy();

        // Check that both instances of uniqueId are present (start and end)
        const idCount = (messageText.match(new RegExp(uniqueId, 'g')) || []).length;
        console.log('[TEST] Found unique ID count:', idCount);
        
        if (idCount !== 2) {
            await screenshot(page, 'ui_truncation_detected');
        }

        expect(idCount).toBe(2);
    });
});
