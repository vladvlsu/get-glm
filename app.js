const express = require('express');
const { chromium } = require('playwright');
const app = express();

app.use(express.json());

let browserInstance = null;
let browserContext = null;

// connect to debugging browser
async function getActivePage() {
    try {
        if (!browserInstance) {
            console.log('chrome is now running on port 9222...');
            browserInstance = await chromium.connectOverCDP('http://127.0.0.1:9222');
            browserContext = browserInstance.contexts()[0];
        }

        const pages = browserContext.pages();
        let targetPage = pages.find(p => p.url().includes('z.ai'));

        if (!targetPage) {
            console.log('the needed tab cant be found');
            targetPage = await browserContext.newPage();
            await targetPage.goto('https://zwork.z.ai/web/', { waitUntil: 'domcontentloaded' });
        }

        return targetPage;
    } catch (err) {
        console.error('error in playwright:', err.message);
        browserInstance = null;
        browserContext = null;
        throw err;
    }
}

// get auth token
async function getToken() {
    const page = await getActivePage();
    const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));

    let token = storage['autoclaw.web.authToken'];

    if (!token) {
        console.error("not found the auth token. fail, chel");
        return null;
    }

    // formatting
    if (token.startsWith('Bearer ')) {
        token = token.slice(7);
    }

    console.log("Extracted Auth Token:", token.substring(0, 15) + "...");
    return token;
}

// stream to glm
async function performRequest(token, userPrompt) {
    const response = await fetch("https://autoglm-api.autoglm.ai/autoclaw-proxy/proxy/autoclaw/chat/completions", {
        method: 'POST',
        headers: {
            "Authorization": "Bearer autoclaw-internal-proxy",
            "X-Authorization": `Bearer ${token}`, // Clean token injected here
            "X-Request-Model": "zai_glm-5-turbo",
            "X-Client-Type": "web",
            "X-Tm": "linux",
            "X-Version": "1.6.0",
            "X-Product": "autoclaw",
            "X-Channel": "official",
            "X-Lang": "en",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "zai_glm-5-turbo",
            messages: [
                { role: "system", content: "you are ai assistant" },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 500,
            stream: true,
            thinking: { type: "disabled" }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
    }

    return response.body;
}

// requests handling
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).send('message param is required');
    }

    try {
        const token = await getToken();
        if (!token) {
            throw new Error("no connection to debugging browser");
        }

        const stream = await performRequest(token, message);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();

    } catch (err) {
        console.error('Transmission processing failed:', err.message);
        res.status(500).set('Content-Type', 'text/plain').send('TRANSMISSION FAILURE: ' + err.message);
    }
});

// run server
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Galactic Command Terminal</title>
        <style>
            :root {
                --space-black: #0b0b0e;
                --sw-yellow: #ffe81f;
                --rebel-red: #f12929;
                --plasma-blue: #29b6f6;
                --terminal-bg: rgba(16, 18, 23, 0.85);
            }
            body {
                background-color: var(--space-black);
                color: #e0e0e0;
                font-family: 'Courier New', Courier, monospace;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                box-sizing: border-box;
                background-image: radial-gradient(white, rgba(255,255,255,.2) 2px, transparent 40px);
                background-size: 550px 550px;
            }
            .terminal {
                width: 100%;
                max-width: 800px;
                height: 85vh;
                background: var(--terminal-bg);
                border: 2px solid var(--sw-yellow);
                box-shadow: 0 0 20px rgba(255, 232, 31, 0.2);
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .header {
                background: rgba(255, 232, 31, 0.1);
                padding: 12px;
                border-bottom: 2px solid var(--sw-yellow);
                text-transform: uppercase;
                letter-spacing: 2px;
                color: var(--sw-yellow);
                font-weight: bold;
                text-align: center;
                font-size: 14px;
            }
            .chat-output {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .message {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 4px;
                line-height: 1.5;
                font-size: 14px;
                word-wrap: break-word;
            }
            .message.user {
                align-self: flex-end;
                background: rgba(41, 182, 246, 0.15);
                border: 1px solid var(--plasma-blue);
                color: var(--plasma-blue);
            }
            .message.ai {
                align-self: flex-start;
                background: rgba(255, 232, 31, 0.05);
                border: 1px solid rgba(255, 232, 31, 0.4);
                color: #e0e0e0;
            }
            .message.system {
                align-self: center;
                background: rgba(241, 41, 41, 0.1);
                border: 1px solid var(--rebel-red);
                color: var(--rebel-red);
                font-size: 12px;
            }
            .input-area {
                display: flex;
                border-top: 1px solid rgba(255, 232, 31, 0.3);
                background: rgba(0,0,0,0.4);
            }
            .input-area input {
                flex: 1;
                background: transparent;
                border: none;
                padding: 16px;
                color: #fff;
                font-family: inherit;
                font-size: 15px;
                outline: none;
            }
            .input-area button {
                background: var(--sw-yellow);
                color: var(--space-black);
                border: none;
                padding: 0 24px;
                font-family: inherit;
                font-weight: bold;
                text-transform: uppercase;
                cursor: pointer;
                transition: background 0.2s;
            }
            .input-area button:hover {
                background: #e6cf19;
            }
            .input-area button:disabled {
                background: #555;
                color: #888;
                cursor: not-allowed;
            }
        </style>
    </head>
    <body>
        <div class="terminal">
            <div class="header">COMMS CHANNEL: HOLONET PROXY TERMINAL</div>
            <div class="chat-output" id="output">
                <div class="message ai">Establish connection sequence initiated. Awaiting input, Commander.</div>
            </div>
            <div class="input-area">
                <input type="text" id="userInput" placeholder="Transmit query to the mainframe..." autocomplete="off">
                <button id="sendBtn" onclick="sendMessage()">Send</button>
            </div>
        </div>

        <script>
            const input = document.getElementById('userInput');
            const button = document.getElementById('sendBtn');
            const output = document.getElementById('output');

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !button.disabled) sendMessage();
            });

            async function sendMessage() {
                const text = input.value.trim();
                if (!text) return;

                input.value = '';
                input.disabled = true;
                button.disabled = true;

                appendMessage(text, 'user');
                const aiMessageDiv = appendMessage('', 'ai');

                try {
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(errText);
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder('utf-8');

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });

                        if (chunk.includes('data: ')) {
                            const lines = chunk.split('\\n');
                            for (const line of lines) {
                                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                                    try {
                                        const dataObj = JSON.parse(line.slice(6));
                                        const content = dataObj.choices?.[0]?.delta?.content || "";
                                        aiMessageDiv.textContent += content;
                                    } catch (e) {} // Ignore partial JSON chunks
                                }
                            }
                        } else {
                            aiMessageDiv.textContent += chunk;
                        }

                        output.scrollTop = output.scrollHeight;
                    }

                } catch (err) {
                    appendMessage(err.message, 'system');
                } finally {
                    input.disabled = false;
                    button.disabled = false;
                    input.focus();
                }
            }

            function appendMessage(text, sender) {
                const msg = document.createElement('div');
                msg.className = 'message ' + sender;
                msg.textContent = text;
                output.appendChild(msg);
                output.scrollTop = output.scrollHeight;
                return msg;
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(3000, () => {
    console.log('running on http://127.0.0.1:3000');
    console.log('if smth failed chechout this stuff is running: --remote-debugging-port=9222');
});

