/**
 * Content Script (ISOLATED World)
 * Main content script that handles DOM processing, UI injection,
 * and communication between page script and background worker
 */

import browserAPI from '../shared/browser-api.js';
import { MESSAGE_TYPES, SELECTORS, CSS_CLASSES, VERSION } from '../shared/constants.js';
import { debounce, extractUsername, findInsertionPoint, getFlagEmoji, getDeviceEmoji } from '../shared/utils.js';
import { showModal } from './modal.js';
import { captureEvidence } from './evidence-capture.js';

// State
let isEnabled = true;
let blockedCountries = new Set();
let settings = {};
let csrfToken = null;
let observer = null;
let themeObserver = null;
const processingQueue = new Set();
let stylesInjected = false;
let debugMode = false;

/**
 * Debug logger - only logs when debugMode is enabled
 */
function debug(...args) {
    if (debugMode) {
        console.log('🔍 X-Posed:', ...args);
    }
}

/**
 * Initialize the content script
 */
async function initialize() {
    console.log(`🚀 X-Posed v${VERSION} initializing...`);
    
    try {
        // IMPORTANT: Set up event listener BEFORE injecting page script
        // This ensures we don't miss any header capture events
        setupPageScriptListener();
        
        // Listen for messages from background
        setupBackgroundListener();

        // Extract CSRF token from cookies
        csrfToken = getCsrfToken();
        
        // Inject page script for header interception AFTER listener is ready
        injectPageScript();

        // Load initial settings and blocked countries from background
        const [settingsResponse, blockedResponse] = await Promise.all([
            sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS }),
            sendMessage({ type: MESSAGE_TYPES.GET_BLOCKED_COUNTRIES })
        ]);

        if (settingsResponse?.success) {
            settings = settingsResponse.data;
            isEnabled = settings.enabled !== false;
            debugMode = settings.debugMode === true;
        }
        
        console.log(`✅ X-Posed initialized (enabled: ${isEnabled}, debug: ${debugMode})`);

        if (blockedResponse?.success) {
            blockedCountries = new Set(blockedResponse.data);
        }

        // Inject styles
        injectStyles();

        // Detect and apply theme
        detectAndApplyTheme();
        startThemeObserver();

        // Start DOM observation when ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                startObserver();
                injectSidebarLink();
            });
        } else {
            startObserver();
            injectSidebarLink();
        }

    } catch (error) {
        console.error('X-Posed initialization failed:', error);
    }
}

/**
 * Send message to background script
 */
async function sendMessage(message) {
    try {
        return await browserAPI.runtime.sendMessage(message);
    } catch (error) {
        console.error('Message send error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get CSRF token from cookies
 */
function getCsrfToken() {
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
        const [key, value] = cookie.split('=');
        if (key === 'ct0') {
            return value;
        }
    }
    return null;
}

/**
 * Inject page script into MAIN world
 */
function injectPageScript() {
    // Get the script URL from extension
    const scriptUrl = browserAPI.runtime.getURL('page-script.js');
    
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = function() {
        this.remove();
    };
    
    // Inject at document_start
    (document.head || document.documentElement).appendChild(script);
}

/**
 * Listen for events from page script
 */
function setupPageScriptListener() {
    window.addEventListener('x-posed-headers-captured', async event => {
        const { headers } = event.detail;
        debug('Headers captured from page script');
        
        // Send captured headers to background
        await sendMessage({
            type: MESSAGE_TYPES.CAPTURE_HEADERS,
            payload: { headers }
        });
    });
}

/**
 * Listen for messages from background script
 */
function setupBackgroundListener() {
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const { type, payload } = message;

        switch (type) {
            case MESSAGE_TYPES.SETTINGS_UPDATED:
                settings = payload;
                isEnabled = settings.enabled !== false;
                debugMode = settings.debugMode === true;
                debug('Settings updated:', settings);
                if (!isEnabled) {
                    // Remove existing badges if disabled
                    document.querySelectorAll(`.${CSS_CLASSES.INFO_BADGE}`).forEach(el => el.remove());
                }
                sendResponse({ success: true });
                break;

            case MESSAGE_TYPES.BLOCKED_COUNTRIES_UPDATED:
                blockedCountries = new Set(payload);
                updateBlockedTweets();
                sendResponse({ success: true });
                break;
        }

        return true;
    });
}

/**
 * Update visibility of tweets based on blocked countries
 */
function updateBlockedTweets() {
    document.querySelectorAll('[data-x-screen-name]').forEach(element => {
        const screenName = element.dataset.xScreenName;
        const country = element.dataset.xCountry;
        
        if (!country) return;
        
        const tweet = element.closest(SELECTORS.TWEET);
        if (!tweet) return;
        
        const isBlocked = blockedCountries.has(country.toLowerCase());
        tweet.classList.toggle(CSS_CLASSES.TWEET_BLOCKED, isBlocked);
        
        // Toggle badge visibility
        const badge = element.querySelector(`.${CSS_CLASSES.INFO_BADGE}`);
        if (badge) {
            badge.style.display = isBlocked ? 'none' : '';
        }
    });
}

/**
 * Inject CSS styles
 */
function injectStyles() {
    if (stylesInjected) return;
    
    const styleUrl = browserAPI.runtime.getURL('styles/content.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleUrl;
    document.head.appendChild(link);
    
    stylesInjected = true;
}

/**
 * Detect current X theme and apply data attribute
 */
function detectAndApplyTheme() {
    const theme = detectXTheme();
    document.documentElement.setAttribute('data-x-theme', theme);
    debug(`Theme detected: ${theme}`);
}

/**
 * Detect X's current theme from the page
 */
function detectXTheme() {
    // Check CSS variable first
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
    
    if (bgColor) {
        // Parse the color
        if (bgColor.includes('255, 255, 255') || bgColor === '#ffffff' || bgColor === 'white') {
            return 'light';
        }
        if (bgColor.includes('21, 32, 43') || bgColor === '#15202b') {
            return 'dim';
        }
        if (bgColor.includes('0, 0, 0') || bgColor === '#000000' || bgColor === 'black') {
            return 'dark';
        }
    }
    
    // Fallback: check body background
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    
    if (bodyBg) {
        if (bodyBg.includes('255, 255, 255')) {
            return 'light';
        }
        if (bodyBg.includes('21, 32, 43')) {
            return 'dim';
        }
        if (bodyBg.includes('0, 0, 0')) {
            return 'dark';
        }
    }
    
    // Check HTML background as last resort
    const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    if (htmlBg) {
        if (htmlBg.includes('255, 255, 255')) {
            return 'light';
        }
        if (htmlBg.includes('21, 32, 43')) {
            return 'dim';
        }
    }
    
    return 'dark'; // Default
}

/**
 * Start observer for theme changes
 */
function startThemeObserver() {
    if (themeObserver) return;
    
    themeObserver = new MutationObserver(() => {
        detectAndApplyTheme();
    });
    
    // Observe style changes on documentElement and body
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class']
    });
    
    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }
}

/**
 * Start MutationObserver for DOM changes
 */
function startObserver() {
    if (observer) return;

    // Collect elements without debounce to not lose mutations
    let pendingElements = new Set();
    let processTimeout = null;

    const processPending = () => {
        if (pendingElements.size === 0) return;
        
        const elements = Array.from(pendingElements);
        pendingElements = new Set();
        
        processElementsBatch(elements);
    };

    const scheduleProcessing = () => {
        if (processTimeout) return;
        processTimeout = setTimeout(() => {
            processTimeout = null;
            processPending();
        }, 50); // Reduced from 100ms for faster processing
    };

    observer = new MutationObserver(mutations => {
        if (!isEnabled) return;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                // Check if node matches our selector
                if (node.matches && node.matches(SELECTORS.USERNAME)) {
                    if (!node.dataset.xProcessed) {
                        pendingElements.add(node);
                    }
                }

                // Check descendants
                if (node.querySelectorAll) {
                    node.querySelectorAll(SELECTORS.USERNAME).forEach(el => {
                        if (!el.dataset.xProcessed) {
                            pendingElements.add(el);
                        }
                    });
                }
            }
        }

        // Schedule processing if we have new elements
        if (pendingElements.size > 0) {
            scheduleProcessing();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial scan
    scanPage();
    
    // Also do a delayed scan after X has time to load
    setTimeout(() => scanPage(), 2000);
}

/**
 * Scan the current page for username elements
 */
function scanPage() {
    if (!isEnabled) return;

    const elements = document.querySelectorAll(SELECTORS.USERNAME);
    // Always log scan results so user can see activity
    if (elements.length > 0) {
        console.log(`🔍 X-Posed: Found ${elements.length} username elements to process`);
    }
    processElementsBatch(Array.from(elements));
}

/**
 * Process elements in batches using requestIdleCallback
 */
function processElementsBatch(elements) {
    if (elements.length === 0) return;

    const processNext = deadline => {
        while (elements.length > 0 && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
            const element = elements.shift();
            processElement(element);
        }

        if (elements.length > 0) {
            requestIdleCallback(processNext, { timeout: 100 });
        }
    };

    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(processNext, { timeout: 100 });
    } else {
        // Fallback for browsers without requestIdleCallback
        elements.forEach(el => processElement(el));
    }
}

/**
 * Cache for user info to avoid repeated API calls
 */
const userInfoCache = new Map();

/**
 * Process a single username element
 */
async function processElement(element) {
    const screenName = extractUsername(element);
    if (!screenName) {
        return;
    }
    
    // Check if element was recycled (X's virtual scrolling)
    // If the username changed, we need to re-process
    if (element.dataset.xProcessed) {
        const previousScreenName = element.dataset.xScreenName;
        if (previousScreenName === screenName) {
            // Same user, already processed - check if badge exists
            if (element.querySelector(`.${CSS_CLASSES.INFO_BADGE}`)) {
                return;
            }
            // Badge missing, fall through to re-add it
        } else {
            // Different user - remove old badge and markers
            debug(`Element recycled: @${previousScreenName} → @${screenName}`);
            const oldBadge = element.querySelector(`.${CSS_CLASSES.INFO_BADGE}`);
            if (oldBadge) oldBadge.remove();
            delete element.dataset.xProcessed;
            delete element.dataset.xScreenName;
            delete element.dataset.xCountry;
        }
    }
    
    // Mark as processed
    element.dataset.xProcessed = 'true';
    element.dataset.xScreenName = screenName;

    debug(`Processing @${screenName}`);

    // Check if we already have cached info for this user
    if (userInfoCache.has(screenName)) {
        debug(`Using local cache for @${screenName}`);
        const info = userInfoCache.get(screenName);
        if (info) {
            element.dataset.xCountry = info.location || '';
            
            // Check if blocked
            if (info.location && blockedCountries.has(info.location.toLowerCase())) {
                const tweet = element.closest(SELECTORS.TWEET);
                if (tweet) {
                    tweet.classList.add(CSS_CLASSES.TWEET_BLOCKED);
                }
                return;
            }
            
            // Create badge from cache
            if (info.location || info.device) {
                createBadge(element, screenName, info);
            }
        }
        return;
    }

    // Check if another request is in flight for this user
    if (processingQueue.has(screenName)) {
        // Wait a bit and retry - the cache should be populated
        setTimeout(() => {
            if (userInfoCache.has(screenName)) {
                const info = userInfoCache.get(screenName);
                if (info) {
                    element.dataset.xCountry = info.location || '';
                    if (info.location && blockedCountries.has(info.location.toLowerCase())) {
                        const tweet = element.closest(SELECTORS.TWEET);
                        if (tweet) {
                            tweet.classList.add(CSS_CLASSES.TWEET_BLOCKED);
                        }
                        return;
                    }
                    if (info.location || info.device) {
                        createBadge(element, screenName, info);
                    }
                }
            }
        }, 150); // Reduced from 500ms for faster display
        return;
    }

    processingQueue.add(screenName);
    
    // Only show shimmer in debug mode to reduce DOM overhead
    let shimmer = null;
    if (debugMode) {
        shimmer = document.createElement('span');
        shimmer.className = CSS_CLASSES.FLAG_SHIMMER;
        const insertionPoint = findInsertionPoint(element, screenName);
        if (insertionPoint) {
            insertionPoint.target.insertBefore(shimmer, insertionPoint.ref);
        }
    }

    try {
        // Fetch user info from background
        const response = await sendMessage({
            type: MESSAGE_TYPES.FETCH_USER_INFO,
            payload: { screenName, csrfToken }
        });

        // Remove shimmer if present
        if (shimmer) shimmer.remove();

        if (!response?.success || !response.data) {
            // Always log errors (not just in debug mode)
            if (response?.code === 'RATE_LIMITED') {
                const resetDate = response.retryAfter ? new Date(response.retryAfter) : null;
                let resetStr = 'unknown';
                let relativeStr = '';
                
                if (resetDate) {
                    resetStr = resetDate.toLocaleTimeString();
                    const now = Date.now();
                    const diffMs = resetDate.getTime() - now;
                    
                    if (diffMs > 0) {
                        const diffMins = Math.ceil(diffMs / 60000);
                        if (diffMins >= 60) {
                            const hours = Math.floor(diffMins / 60);
                            const mins = diffMins % 60;
                            relativeStr = mins > 0 ? ` (in ${hours}h ${mins}m)` : ` (in ${hours}h)`;
                        } else {
                            relativeStr = ` (in ${diffMins} min${diffMins > 1 ? 's' : ''})`;
                        }
                    }
                }
                
                console.warn(`⚠️ X-Posed: Rate limited! Resets at ${resetStr}${relativeStr}`);
            } else if (response?.error) {
                debug(`API error for @${screenName}: ${response.error}`);
            }
            userInfoCache.set(screenName, null);
            processingQueue.delete(screenName);
            return;
        }

        const info = response.data;
        debug(`Received data for @${screenName}:`, { location: info.location, device: info.device });
        
        // Store in local cache for subsequent elements
        userInfoCache.set(screenName, info);
        
        element.dataset.xCountry = info.location || '';

        // Check if blocked
        if (info.location && blockedCountries.has(info.location.toLowerCase())) {
            const tweet = element.closest(SELECTORS.TWEET);
            if (tweet) {
                tweet.classList.add(CSS_CLASSES.TWEET_BLOCKED);
            }
            processingQueue.delete(screenName);
            return;
        }

        // Create and insert badge
        if (info.location || info.device) {
            createBadge(element, screenName, info);
        }
    } catch (error) {
        userInfoCache.set(screenName, null);
    } finally {
        processingQueue.delete(screenName);
    }
}

/**
 * Create info badge for a user
 */
function createBadge(element, screenName, info) {
    // Check if badge already exists
    if (element.querySelector(`.${CSS_CLASSES.INFO_BADGE}`)) {
        return;
    }

    const badge = document.createElement('span');
    badge.className = CSS_CLASSES.INFO_BADGE;

    let content = '';

    // Add flag
    if (info.location && settings.showFlags !== false) {
        const flag = getFlagEmoji(info.location);
        if (flag) {
            content += `<span class="x-flag" title="${info.location}">${flag}</span>`;
        }

        // Add VPN indicator
        if (info.locationAccurate === false && settings.showVpnIndicator !== false) {
            content += '<span class="x-vpn" title="Location may not be accurate (VPN/Proxy detected)">🔒</span>';
        }
    }

    // Add device
    if (info.device && settings.showDevices !== false) {
        const emoji = getDeviceEmoji(info.device);
        content += `<span class="x-device" title="Connected via: ${info.device}">${emoji}</span>`;
    }

    if (!content) return;

    // Add camera capture button (reveals on hover)
    content += `<button class="x-capture-btn" title="Capture evidence screenshot" aria-label="Capture evidence">
        <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
            <path fill="currentColor" d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H20v12z"/>
        </svg>
    </button>`;

    badge.innerHTML = content;

    // Add click handler for capture button
    const captureBtn = badge.querySelector('.x-capture-btn');
    if (captureBtn) {
        captureBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            
            // Find the tweet article
            const tweet = element.closest(SELECTORS.TWEET);
            if (tweet) {
                captureEvidence(tweet, info, screenName);
            } else {
                console.warn('X-Posed: Could not find tweet to capture');
            }
        });
    }

    // Find insertion point and insert
    const insertionPoint = findInsertionPoint(element, screenName);
    if (insertionPoint) {
        insertionPoint.target.insertBefore(badge, insertionPoint.ref);
        debug(`Badge inserted for @${screenName}`);
    } else {
        debug(`No insertion point found for @${screenName}`);
    }
}

/**
 * Inject sidebar link for country blocker
 */
function injectSidebarLink() {
    // Wait for sidebar to load
    const checkSidebar = setInterval(() => {
        let nav = document.querySelector(SELECTORS.PRIMARY_NAV);

        if (!nav) {
            const allNavs = document.querySelectorAll(SELECTORS.NAV_ROLE);
            for (const n of allNavs) {
                if (n.querySelector(SELECTORS.PROFILE_LINK)) {
                    nav = n;
                    break;
                }
            }
        }

        if (!nav) {
            const headers = document.querySelectorAll('header');
            for (const header of headers) {
                const n = header.querySelector('nav');
                if (n && n.querySelector(SELECTORS.PROFILE_LINK)) {
                    nav = n;
                    break;
                }
            }
        }

        if (nav) {
            clearInterval(checkSidebar);
            addBlockerLink(nav);
        }
    }, 500);

    // Stop after 10 seconds
    setTimeout(() => clearInterval(checkSidebar), 10000);
}

/**
 * Add blocker link to sidebar
 */
function addBlockerLink(nav) {
    if (document.getElementById('x-country-blocker-link')) return;

    const profileLink = nav.querySelector(SELECTORS.PROFILE_LINK);
    if (!profileLink) return;

    const link = document.createElement('a');
    link.id = 'x-country-blocker-link';
    link.href = '#';
    link.setAttribute('role', 'link');
    link.className = profileLink.className;
    link.setAttribute('aria-label', 'Block Countries');

    link.innerHTML = `
        <div class="css-175oi2r r-sdzlij r-dnmrzs r-1awozwy r-18u37iz r-1777fci r-xyw6el r-o7ynqc r-6416eg">
            <div class="css-175oi2r x-blocker-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rgpd r-1nao33i r-lwhw9o r-cnnz9e">
                    <g><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm6 9.09c0 4-2.55 7.7-6 8.83-3.45-1.13-6-4.82-6-8.83V6.31l6-2.12 6 2.12v4.78z"></path></g>
                </svg>
            </div>
            <div dir="ltr" class="css-146c3p1 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-adyw6z r-135wba7 r-16dba41 r-dlybji r-nazi8o x-blocker-text">
                <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">Block Countries</span>
            </div>
        </div>
    `;

    link.addEventListener('click', e => {
        e.preventDefault();
        showBlockerModal();
    });

    profileLink.parentElement.insertBefore(link, profileLink.nextSibling);
}

/**
 * Show the country blocker modal
 */
function showBlockerModal() {
    showModal(blockedCountries, async (action, country) => {
        const response = await sendMessage({
            type: MESSAGE_TYPES.SET_BLOCKED_COUNTRIES,
            payload: { action, country }
        });
        
        if (response?.success) {
            blockedCountries = new Set(response.data);
        }
        
        return response;
    });
}

// Initialize when script loads
initialize();

// Export for potential debugging
window.__X_POSED_CONTENT__ = {
    version: VERSION,
    scanPage,
    getState: () => ({ isEnabled, blockedCountries: Array.from(blockedCountries), settings })
};