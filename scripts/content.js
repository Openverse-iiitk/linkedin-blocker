(function() {
    'use strict';

    // --- CONFIGURATION & CONSTANTS ---

    const CONFIG = {
        // Note: LinkedIn class names can change frequently.
        // If the extension stops working, these selectors are the first place to check.
        selectors: {
            feedContainer: 'main.scaffold-layout__main', // More specific than document.body
            post: '.feed-shared-update-v2',
            postContent: '.update-components-update-v2__commentary',
            actorContainer: '.update-components-actor__container',
            actorName: '.update-components-actor__title span[aria-hidden="true"]',
            actorDescription: '.update-components-actor__description span[aria-hidden="true"]',
            actorSubDescription: '.update-components-actor__sub-description span[aria-hidden="true"]',
        },
        api: {
            url: 'https://api.groq.com/openai/v1/chat/completions',
            model: 'gemma2-9b-it',
        },
        debounceWait: 500, // ms to wait after the last post is detected before processing
        css: `
            .lff-hidden-post {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .lff-blur-wrapper {
                filter: blur(10px);
                transition: filter 0.3s ease;
                pointer-events: none;
            }
            .lff-blur-container {
                position: relative;
                overflow: hidden;
            }
            .lff-view-button {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10;
                background-color: #0a66c2;
                color: white;
                border: none;
                padding: 12px 24px;
                font-size: 14px;
                border-radius: 24px;
                cursor: pointer;
                font-weight: 600;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                transition: all 0.2s ease;
            }
            .lff-view-button:hover {
                background-color: #004182;
                box-shadow: 0 0 12px rgba(0,0,0,0.15);
            }
        `
    };

    const SYSTEM_PROMPT = `
        You are the embodiment of a jaded, arrogant, and hyper-intelligent undergraduate student. You're scrolling LinkedIn on your laptop during a boring lecture, and your tolerance for corporate nonsense, empty platitudes, and self-congratulatory drivel is absolute zero. You believe 99% of LinkedIn is a performative wasteland. Your goal is to filter out anything that isn't genuinely insightful, novel, or immediately useful. Be merciless.

        Analyze the post through this cynical lens. Flag it if it contains any of the following unforgivable sins:

        **The Unforgivable Sins (Instant Block):**
        - **Vague "Hustle" Gospel:** Any post that uses phrases like "work hard," "be consistent," "embrace the grind," or "never give up" without providing a detailed, replicable framework. This is fortune cookie wisdom, not advice.
        - **Performative Humility (Humblebrags):** Posts starting with "Humbled and honored to announce..." or "I'm so excited to share..." that are just announcements of a new job, promotion, or award. It's bragging, not sharing.
        - **The "CEO Parable":** Any story that starts with "I saw a janitor..." or "My Uber driver told me..." and ends with a trite business lesson. It's condescending and almost certainly fabricated.
        - **Engagement Bait 2.0:** "What are your thoughts?", polls with obvious answers ("Is learning important?"), or asking for comments to receive a "free resource." This is just begging for likes.
        - **Corporate Fan-Fiction:** Glorifying a company's culture, a boss, or a product with no critical thought. Reads like a press release.
        - **The "Look at My Life" Post:** Pictures of a new car, a vacation, or a fancy dinner with a weak link back to business. It's just showing off.
        - **Buzzword Salad:** Overuse of terms like "synergy," "paradigm shift," "leveraging," "unpacking," or "circle back." It's a sign of someone trying to sound smart without saying anything.

        **Your Internal Monologue (Do not output):**
        1.  Is this person just seeking validation and head-pats from their network?
        2.  Did I learn a single, non-obvious, actionable thing from this post?
        3.  Is this just a public diary entry disguised as a business lesson?
        4.  If you removed all the buzzwords and emotional fluff, is there any substance left?
        5.  Is this intellectually bankrupt?

        **Final Command:**
        After your scathing analysis, you MUST conclude your response with ONLY ONE of two phrases. If the post is utterly worthless according to your high standards, respond with **POST_IS_CRINGE**. If, by some miracle, it provides genuine, specific, and valuable insight, respond with **POST_IS_NOT_CRINGE**. There is no middle ground. Be brutal.
    `;

    // --- STATE ---

    const state = {
        apiKey: null,
        isEnabled: false,
        filterMode: 'blur',
        processedPosts: new Set(),
    };

    // --- UTILITY FUNCTIONS ---

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function injectCSS(css) {
        const styleId = 'linkedin-feed-filter-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    // --- CORE LOGIC ---

    async function fetchSettings() {
        return new Promise(resolve => {
            chrome.storage.sync.get(["groqApiKey", "isEnabled", "filterMode"], (data) => {
                state.apiKey = data.groqApiKey;
                state.isEnabled = data.isEnabled || false;
                state.filterMode = data.filterMode || 'blur';
                resolve();
            });
        });
    }

    function updateCringeStats(postText) {
        const wordCount = postText.split(/\s+/).length;
        let timeSaved = 5; // Default for short posts
        if (wordCount > 50) timeSaved = 20; // Long posts
        else if (wordCount > 20) timeSaved = 10; // Medium posts

        chrome.storage.sync.get(["cringeCount", "timeSavedInMinutes"], (data) => {
            const newCount = (data.cringeCount || 0) + 1;
            const newTimeSaved = (parseFloat(data.timeSavedInMinutes) || 0) + (timeSaved / 60);
            chrome.storage.sync.set({ cringeCount: newCount, timeSavedInMinutes: newTimeSaved });
        });
    }

    function applyFilter(postElement) {
        if (state.filterMode === 'remove') {
            postElement.classList.add('lff-hidden-post');
            console.log('[LinkedIn Feed Filter] Post removed.');
        } else { // 'blur' mode
            postElement.classList.add('lff-blur-container');

            const wrapper = document.createElement('div');
            wrapper.className = 'lff-blur-wrapper';
            
            while (postElement.firstChild) {
                wrapper.appendChild(postElement.firstChild);
            }
            postElement.appendChild(wrapper);

            const button = document.createElement('button');
            button.innerText = 'Click to View';
            button.className = 'lff-view-button';

            button.addEventListener('click', (e) => {
                e.stopPropagation();
                wrapper.style.filter = 'none';
                button.remove();
            }, { once: true });

            postElement.appendChild(button);
        }
    }

    async function isCringe(postData) {
        if (postData.actorDescription.toLowerCase().includes('promoted') || postData.actorSubDescription.toLowerCase().includes('promoted')) {
            return true; // Rule 0: Filter promoted content without an API call
        }

        try {
            const response = await fetch(CONFIG.api.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: CONFIG.api.model,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: `LinkedIn Post:\n\n${postData.postContent}` }
                    ],
                    temperature: 0.1,
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content.includes('POST_IS_CRINGE') || false;
        } catch (error) {
            console.error('[LinkedIn Feed Filter] Error checking post:', error);
            return false;
        }
    }

    async function processPost(postElement) {
        if (state.processedPosts.has(postElement)) return;
        state.processedPosts.add(postElement);

        const contentElement = postElement.querySelector(CONFIG.selectors.postContent);
        if (!contentElement) return;

        const actorContainer = postElement.querySelector(CONFIG.selectors.actorContainer);
        const postData = {
            actorName: actorContainer?.querySelector(CONFIG.selectors.actorName)?.textContent.trim() || 'Unknown',
            actorDescription: actorContainer?.querySelector(CONFIG.selectors.actorDescription)?.textContent.trim() || '',
            actorSubDescription: actorContainer?.querySelector(CONFIG.selectors.actorSubDescription)?.textContent.trim() || '',
            postContent: contentElement.innerText.trim(),
        };

        if (await isCringe(postData)) {
            applyFilter(postElement);
            updateCringeStats(postData.postContent);
        }
    }

    const debouncedProcessFeed = debounce(() => {
        document.querySelectorAll(CONFIG.selectors.post).forEach(post => processPost(post));
    }, CONFIG.debounceWait);

    function observeFeedChanges(node) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // A new post chunk might have been added. Re-scan the feed.
                    debouncedProcessFeed();
                    return; // No need to check other mutations in this batch
                }
            }
        });
        observer.observe(node, { childList: true, subtree: true });
    }

    // --- INITIALIZATION ---

    async function init() {
        await fetchSettings();
        if (!state.isEnabled || !state.apiKey) {
            console.warn('[LinkedIn Feed Filter] Extension is disabled or API key is not set.');
            return;
        }

        console.log('[LinkedIn Feed Filter] Initialized.');
        injectCSS(CONFIG.css);
        
        debouncedProcessFeed(); // Process posts already on the page
        
        const feedNode = document.querySelector(CONFIG.selectors.feedContainer) || document.body;
        observeFeedChanges(feedNode);
    }

    // Handle messages from popup (e.g., when settings change)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "settingsUpdated") {
            console.log('[LinkedIn Feed Filter] Settings updated. Re-initializing.');
            // Re-initialize to apply new settings without a page reload
            init();
        }
        return true; // Indicates you wish to send a response asynchronously
    });

    init();

})();
