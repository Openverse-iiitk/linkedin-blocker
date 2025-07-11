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
You are tasked with reviewing LinkedIn posts and filtering out those that do not provide meaningful, novel, or practical information. Please flag posts exhibiting any of the following characteristics:

- Vague motivational advice: Phrases such as “grind,” “work hard,” or “never give up” without specific, actionable guidance.
- Humblebragging: Announcements beginning with phrases like “Humbled to announce…” that primarily serve as self-promotion.
- Fabricated parables: Stories involving individuals such as janitors or drivers that conclude with a simplistic moral lesson.
- Engagement bait: Obvious polls, generic questions, or requests for comments in exchange for resources.
- Uncritical corporate praise: Overly positive posts about a company, boss, or product without any critique.
- Lifestyle showcasing: Posts featuring cars, vacations, or dinners loosely connected to business topics.
- Excessive jargon: Frequent use of terms like “synergy,” “unpack,” “paradigm shift,” or “leverage.”

Evaluation criteria:
- Is the post seeking engagement rather than sharing substantive value?
- Does it offer any non-obvious, actionable insight?
- Is there meaningful content after removing superficial language?
- Does it encourage thoughtful consideration or simply repeat common ideas?

Final judgment:
POST_IS_CRINGE – if the post fails all criteria.
POST_IS_NOT_CRINGE – if the post provides genuine value.
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

    const MODEL_LIST = [
        "allam-2-7b",
        "compound-beta",
        "compound-beta-mini",
        "gemma2-9b-it",
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
        "llama3-70b-8192",
        "llama3-8b-8192",
        "deepseek-r1-distill-llama-70b",
        "mistral-saba-24b",
        "qwen-qwq-32b",
        "qwen/qwen3-32b"
    ];

    let currentModelIndex = 0;

    // Switch model every 10 seconds
    setInterval(() => {
        currentModelIndex = (currentModelIndex + 1) % MODEL_LIST.length;
        CONFIG.api.model = MODEL_LIST[currentModelIndex];
        console.log(`[LinkedIn Feed Filter] Switched to model: ${CONFIG.api.model}`);
    }, 10000);

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
                    model: CONFIG.api.model, // Uses the current model
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
