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
app.listen(3000, () => {
    console.log('running on http://127.0.0.1:3000');
    console.log('if smth failed chechout this stuff is running: --remote-debugging-port=9222');
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <title>AI Console</title>

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                darkMode: 'class',
                theme: {
                    extend: {
                        colors: {
                            border: 'hsl(var(--border))',
                            input: 'hsl(var(--input))',
                            ring: 'hsl(var(--ring))',
                            background: 'hsl(var(--background))',
                            foreground: 'hsl(var(--foreground))',
                            primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                            secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                            destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
                            muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                            accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
                            popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
                            card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' }
                        },
                        borderRadius: {
                            lg: 'var(--radius)',
                            md: 'calc(var(--radius) - 2px)',
                            sm: 'calc(var(--radius) - 4px)'
                        },
                        fontFamily: {
                            sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
                        }
                    }
                }
            }
        </script>

        <style>
            :root {
                --background: 0 0% 100%;
                --foreground: 222.2 84% 4.9%;
                --card: 0 0% 100%;
                --card-foreground: 222.2 84% 4.9%;
                --popover: 0 0% 100%;
                --popover-foreground: 222.2 84% 4.9%;
                --primary: 222.2 47.4% 11.2%;
                --primary-foreground: 210 40% 98%;
                --secondary: 210 40% 96.1%;
                --secondary-foreground: 222.2 47.4% 11.2%;
                --muted: 210 40% 96.1%;
                --muted-foreground: 215.4 16.3% 46.9%;
                --accent: 210 40% 96.1%;
                --accent-foreground: 222.2 47.4% 11.2%;
                --destructive: 0 84.2% 60.2%;
                --destructive-foreground: 210 40% 98%;
                --border: 214.3 31.8% 91.4%;
                --input: 214.3 31.8% 91.4%;
                --ring: 222.2 84% 4.9%;
                --radius: 0.625rem;
            }
            .dark {
                --background: 224 71% 4%;
                --foreground: 210 20% 98%;
                --card: 224 33% 6.5%;
                --card-foreground: 210 20% 98%;
                --popover: 224 33% 6.5%;
                --popover-foreground: 210 20% 98%;
                --primary: 210 20% 98%;
                --primary-foreground: 222.2 47.4% 11.2%;
                --secondary: 215 27.9% 15%;
                --secondary-foreground: 210 20% 98%;
                --muted: 215 27.9% 13%;
                --muted-foreground: 217.9 10.6% 64.9%;
                --accent: 215 27.9% 16.9%;
                --accent-foreground: 210 20% 98%;
                --destructive: 0 72% 51%;
                --destructive-foreground: 210 20% 98%;
                --border: 215 27.9% 16.9%;
                --input: 215 27.9% 16.9%;
                --ring: 216 12.2% 70%;
                --radius: 0.625rem;
            }
            * { border-color: hsl(var(--border)); }
            body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
            .font-term { font-family: 'JetBrains Mono', ui-monospace, monospace; }
            #output::-webkit-scrollbar { width: 8px; }
            #output::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 9999px; }
            @keyframes fade-in-up {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .msg-enter { animation: fade-in-up .22s ease-out; }
            [data-state="hidden"] { display: none !important; }
        </style>
    </head>
    <body class="min-h-screen bg-background font-sans text-foreground antialiased">

        <div class="pointer-events-none fixed inset-0 overflow-hidden">
            <div class="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"></div>
        </div>

        <div class="relative z-10 flex min-h-screen w-full items-center justify-center p-4 md:p-8">
            <div class="flex flex-col items-center">

                <div id="consoleWrap" class="relative" style="width: min(42rem, 96vw); height: min(720px, 88vh);">

                <div id="consoleCard" class="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">

                    <div class="relative w-full shrink-0 border-b border-border" style="aspect-ratio: 16 / 10; max-height: 132px;">
                        <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"></div>
                        <div class="absolute inset-0 opacity-30" style="background-image: radial-gradient(hsl(var(--border)) 1px, transparent 1px); background-size: 18px 18px;"></div>
                        <div class="relative flex h-full items-center justify-between px-5">
                            <div class="flex items-center gap-3">
                                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                        <path d="M12 8V4H8"></path>
                                        <rect width="16" height="12" x="4" y="8" rx="2"></rect>
                                        <path d="M2 14h2M20 14h2M15 13v2M9 13v2"></path>
                                    </svg>
                                </span>
                                <div class="leading-tight">
                                    <p class="text-sm font-semibold tracking-tight">AI Console</p>
                                    <p class="text-xs text-muted-foreground">Holonet proxy terminal</p>
                                </div>
                            </div>
                            <button id="settingsBtn" type="button" aria-label="Open settings" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-5 py-2.5">
                        <span class="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                            <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span> Online
                        </span>
                        <span class="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">Encrypted</span>
                        <span class="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">Model v2.4</span>
                        <span id="streamBadge" data-state="hidden" class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
                            Streaming
                        </span>
                    </div>

                    <div id="output" class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
                        <div class="flex items-start gap-2.5 msg-enter">
                            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-secondary-foreground">AI</span>
                            <div class="max-w-[80%] rounded-lg border border-border bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed">Establish connection sequence initiated. Awaiting input, Commander.</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 border-t border-border p-4">
                        <input id="userInput" type="text" placeholder="Transmit a query to the mainframe..." autocomplete="off"
                            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                        <button id="sendBtn" type="button"
                            class="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50">
                            <span id="sendLabel">Send</span>
                        </button>
                    </div>
                </div>

                    <div id="resizeHandle" class="absolute bottom-0 right-0 z-20 flex h-5 w-5 touch-none select-none items-end justify-end p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground" style="cursor: nwse-resize;" aria-label="Drag to resize, double-click to reset" title="Drag to resize · double-click to reset">
                        <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
                            <path d="M12.5 3.5 3.5 12.5"></path>
                            <path d="M12.5 8 8 12.5"></path>
                            <path d="M12.5 12.5h.01"></path>
                        </svg>
                    </div>
                </div>

                <p class="mt-3 max-w-2xl text-center text-xs text-muted-foreground">Routed through encrypted relay &middot; responses stream in real time &middot; drag the corner to resize</p>
            </div>
        </div>

        <div id="dialogOverlay" data-state="hidden" class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"></div>
        <div id="dialogContent" data-state="hidden" role="dialog" aria-modal="true"
            class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg">
            <button id="dialogClose" type="button" aria-label="Close" class="absolute right-4 top-4 rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
            </button>
            <div class="mb-4 flex flex-col gap-1.5">
                <h2 class="text-sm font-semibold leading-none tracking-tight">Console settings</h2>
                <p class="text-sm text-muted-foreground">Adjust how this channel identifies you.</p>
            </div>
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-1.5">
                    <label for="displayName" class="text-sm font-medium leading-none">Display name</label>
                    <input id="displayName" type="text" value="Commander"
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                </div>
                <div class="flex flex-col gap-1.5">
                    <label for="channelId" class="text-sm font-medium leading-none">Channel ID</label>
                    <input id="channelId" type="text" value="HLNT-2291" disabled
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                </div>
            </div>
            <div class="mt-6 flex justify-end gap-2">
                <button id="dialogCancel" type="button"
                    class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Cancel
                </button>
                <button id="dialogSave" type="button"
                    class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    Save changes
                </button>
            </div>
        </div>

        <script>
            var input = document.getElementById('userInput');
            var sendBtn = document.getElementById('sendBtn');
            var sendLabel = document.getElementById('sendLabel');
            var output = document.getElementById('output');
            var streamBadge = document.getElementById('streamBadge');
            var settingsBtn = document.getElementById('settingsBtn');
            var dialogOverlay = document.getElementById('dialogOverlay');
            var dialogContent = document.getElementById('dialogContent');
            var dialogCancel = document.getElementById('dialogCancel');
            var dialogClose = document.getElementById('dialogClose');
            var dialogSave = document.getElementById('dialogSave');
            var consoleWrap = document.getElementById('consoleWrap');
            var resizeHandle = document.getElementById('resizeHandle');

            var SPINNER_SVG = '<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';

            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !sendBtn.disabled) sendMessage();
            });
            sendBtn.addEventListener('click', sendMessage);

            settingsBtn.addEventListener('click', openDialog);
            dialogCancel.addEventListener('click', closeDialog);
            dialogClose.addEventListener('click', closeDialog);
            dialogSave.addEventListener('click', closeDialog);
            dialogOverlay.addEventListener('click', closeDialog);
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && dialogContent.getAttribute('data-state') !== 'hidden') closeDialog();
            });

            function openDialog() {
                dialogOverlay.setAttribute('data-state', 'visible');
                dialogContent.setAttribute('data-state', 'visible');
            }
            function closeDialog() {
                dialogOverlay.setAttribute('data-state', 'hidden');
                dialogContent.setAttribute('data-state', 'hidden');
            }

            // --- Resizable console: drag the corner grip, double-click to reset ---
            var DEFAULT_W = 672;
            var DEFAULT_H = Math.min(720, Math.round(window.innerHeight * 0.88));
            var MIN_W = 280;
            var MIN_H = 360;
            var resizing = false;
            var startX, startY, startW, startH;

            function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
            function maxW() { return Math.round(window.innerWidth * 0.96); }
            function maxH() { return Math.round(window.innerHeight * 0.92); }

            function applySize(w, h) {
                consoleWrap.style.width = clamp(w, MIN_W, maxW()) + 'px';
                consoleWrap.style.height = clamp(h, MIN_H, maxH()) + 'px';
            }

            // Freeze the current responsive size into explicit pixels so it becomes freely draggable
            var initRect = consoleWrap.getBoundingClientRect();
            applySize(initRect.width, initRect.height);

            resizeHandle.addEventListener('pointerdown', function (e) {
                resizing = true;
                startX = e.clientX;
                startY = e.clientY;
                var rect = consoleWrap.getBoundingClientRect();
                startW = rect.width;
                startH = rect.height;
                resizeHandle.setPointerCapture(e.pointerId);
                document.body.style.cursor = 'nwse-resize';
                document.body.style.userSelect = 'none';
            });
            resizeHandle.addEventListener('pointermove', function (e) {
                if (!resizing) return;
                applySize(startW + (e.clientX - startX), startH + (e.clientY - startY));
            });
            function stopResizing(e) {
                if (!resizing) return;
                resizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                try { resizeHandle.releasePointerCapture(e.pointerId); } catch (err) {}
            }
            resizeHandle.addEventListener('pointerup', stopResizing);
            resizeHandle.addEventListener('pointercancel', stopResizing);
            resizeHandle.addEventListener('dblclick', function () {
                applySize(DEFAULT_W, DEFAULT_H);
            });
            window.addEventListener('resize', function () {
                var rect = consoleWrap.getBoundingClientRect();
                applySize(rect.width, rect.height);
            });

            function escapeHtml(str) {
                var div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            }

            function avatarHtml(label, isUser) {
                var cls = isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground';
                return '<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border ' + cls + ' text-[10px] font-semibold">' + label + '</span>';
            }

            function appendMessage(text, sender) {
                var row = document.createElement('div');
                if (sender === 'user') {
                    row.className = 'flex items-start gap-2.5 justify-end msg-enter';
                    row.innerHTML = '<div class="max-w-[80%] rounded-lg bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">' + escapeHtml(text) + '</div>' + avatarHtml('U', true);
                    output.appendChild(row);
                    output.scrollTop = output.scrollHeight;
                    return row;
                }
                if (sender === 'ai') {
                    row.className = 'flex items-start gap-2.5 msg-enter';
                    row.innerHTML = avatarHtml('AI', false) + '<div class="ai-bubble max-w-[80%] rounded-lg border border-border bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed"></div>';
                    output.appendChild(row);
                    output.scrollTop = output.scrollHeight;
                    var bubble = row.querySelector('.ai-bubble');
                    bubble.innerHTML = '<span class="inline-flex items-center gap-2 text-muted-foreground">' + SPINNER_SVG + 'Thinking&hellip;</span>';
                    return bubble;
                }
                row.className = 'flex justify-center msg-enter';
                row.innerHTML = '<span class="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">' + escapeHtml(text) + '</span>';
                output.appendChild(row);
                output.scrollTop = output.scrollHeight;
                return row;
            }

            function setSending(isSending) {
                input.disabled = isSending;
                sendBtn.disabled = isSending;
                streamBadge.setAttribute('data-state', isSending ? 'visible' : 'hidden');
                sendLabel.textContent = isSending ? 'Sending' : 'Send';
                var existingSpinner = sendBtn.querySelector('svg');
                if (isSending && !existingSpinner) {
                    sendBtn.insertAdjacentHTML('afterbegin', SPINNER_SVG);
                } else if (!isSending && existingSpinner) {
                    existingSpinner.remove();
                }
            }

            async function sendMessage() {
                var text = input.value.trim();
                if (!text) return;

                input.value = '';
                setSending(true);

                appendMessage(text, 'user');
                var aiBubble = appendMessage('', 'ai');
                var firstChunk = true;

                try {
                    var response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                    });

                    if (!response.ok) {
                        var errText = await response.text();
                        throw new Error(errText);
                    }

                    var reader = response.body.getReader();
                    var decoder = new TextDecoder('utf-8');

                    while (true) {
                        var result = await reader.read();
                        if (result.done) break;

                        var chunk = decoder.decode(result.value, { stream: true });

                        if (chunk.includes('data: ')) {
                            var lines = chunk.split('\\n');
                            for (var i = 0; i < lines.length; i++) {
                                var line = lines[i];
                                if (line.indexOf('data: ') === 0 && line.indexOf('[DONE]') === -1) {
                                    try {
                                        var dataObj = JSON.parse(line.slice(6));
                                        var content = (dataObj.choices && dataObj.choices[0] && dataObj.choices[0].delta && dataObj.choices[0].delta.content) || '';
                                        if (content) {
                                            if (firstChunk) { aiBubble.textContent = ''; firstChunk = false; }
                                            aiBubble.textContent += content;
                                        }
                                    } catch (e) {} // Ignore partial JSON chunks
                                }
                            }
                        } else if (chunk) {
                            if (firstChunk) { aiBubble.textContent = ''; firstChunk = false; }
                            aiBubble.textContent += chunk;
                        }

                        output.scrollTop = output.scrollHeight;
                    }

                    if (firstChunk) aiBubble.textContent = '...';

                } catch (err) {
                    aiBubble.closest('.flex').remove();
                    appendMessage(err.message, 'system');
                } finally {
                    setSending(false);
                    input.focus();
                }
            }
        </script>
    </body>
    </html>
 `);
});
