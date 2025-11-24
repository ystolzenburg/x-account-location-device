(function() {
    'use strict';

    /**
     * Configuration & Constants
     */
    const CONFIG = {
        VERSION: '1.2.0',
        CACHE_KEY: 'x_location_cache_v2',
        CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
        API: {
            QUERY_ID: 'XRqGa7EeokUU5kppkh13EA', // AboutAccountQuery
            MIN_INTERVAL: 2000,
            MAX_CONCURRENT: 2,
            RETRY_DELAY: 5000
        },
        SELECTORS: {
            USERNAME: '[data-testid="UserName"], [data-testid="User-Name"]',
            TWEET: 'article[data-testid="tweet"]',
            USER_CELL: '[data-testid="UserCell"]',
            LINKS: 'a[href^="/"]'
        },
        STYLES: {
            SHIMMER_ID: 'x-flag-shimmer-style',
            FLAG_CLASS: 'x-location-flag',
            DEVICE_CLASS: 'x-device-indicator'
        }
    };

    /**
     * Country & Flag Data
     * Optimized for O(1) lookup
     */
    const COUNTRY_FLAGS = {
        "afghanistan": "🇦🇫", "albania": "🇦🇱", "algeria": "🇩🇿", "andorra": "🇦🇩", "angola": "🇦🇴",
        "antigua and barbuda": "🇦🇬", "argentina": "🇦🇷", "armenia": "🇦🇲", "australia": "🇦🇺", "austria": "🇦🇹",
        "azerbaijan": "🇦🇿", "bahamas": "🇧🇸", "bahrain": "🇧🇭", "bangladesh": "🇧🇩", "barbados": "🇧🇧",
        "belarus": "🇧🇾", "belgium": "🇧🇪", "belize": "🇧🇿", "benin": "🇧🇯", "bhutan": "🇧🇹",
        "bolivia": "🇧🇴", "bosnia and herzegovina": "🇧🇦", "bosnia": "🇧🇦", "botswana": "🇧🇼", "brazil": "🇧🇷",
        "brunei": "🇧🇳", "bulgaria": "🇧🇬", "burkina faso": "🇧🇫", "burundi": "🇧🇮", "cambodia": "🇰🇭",
        "cameroon": "🇨🇲", "canada": "🇨🇦", "cape verde": "🇨🇻", "central african republic": "🇨🇫", "chad": "🇹🇩",
        "chile": "🇨🇱", "china": "🇨🇳", "colombia": "🇨🇴", "comoros": "🇰🇲", "congo": "🇨🇬",
        "costa rica": "🇨🇷", "croatia": "🇭🇷", "cuba": "🇨🇺", "cyprus": "🇨🇾", "czech republic": "🇨🇿",
        "czechia": "🇨🇿", "democratic republic of the congo": "🇨🇩", "denmark": "🇩🇰", "djibouti": "🇩🇯", "dominica": "🇩🇲",
        "dominican republic": "🇩🇴", "east timor": "🇹🇱", "ecuador": "🇪🇨", "egypt": "🇪🇬", "el salvador": "🇸🇻",
        "england": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "equatorial guinea": "🇬🇶", "eritrea": "🇪🇷", "estonia": "🇪🇪", "eswatini": "🇸🇿",
        "ethiopia": "🇪🇹", "europe": "🇪🇺", "european union": "🇪🇺", "fiji": "🇫🇯", "finland": "🇫🇮",
        "france": "🇫🇷", "gabon": "🇬🇦", "gambia": "🇬🇲", "georgia": "🇬🇪", "germany": "🇩🇪",
        "ghana": "🇬🇭", "greece": "🇬🇷", "grenada": "🇬🇩", "guatemala": "🇬🇹", "guinea": "🇬🇳",
        "guinea-bissau": "🇬🇼", "guyana": "🇬🇾", "haiti": "🇭🇹", "honduras": "🇭🇳", "hong kong": "🇭🇰",
        "hungary": "🇭🇺", "iceland": "🇮🇸", "india": "🇮🇳", "indonesia": "🇮🇩", "iran": "🇮🇷",
        "iraq": "🇮🇶", "ireland": "🇮🇪", "israel": "🇮🇱", "italy": "🇮🇹", "ivory coast": "🇨🇮",
        "jamaica": "🇯🇲", "japan": "🇯🇵", "jordan": "🇯🇴", "kazakhstan": "🇰🇿", "kenya": "🇰🇪",
        "kiribati": "🇰🇮", "korea": "🇰🇷", "kosovo": "🇽🇰", "kuwait": "🇰🇼", "kyrgyzstan": "🇰🇬",
        "laos": "🇱🇦", "latvia": "🇱🇻", "lebanon": "🇱🇧", "lesotho": "🇱🇸", "liberia": "🇱🇷",
        "libya": "🇱🇾", "liechtenstein": "🇱🇮", "lithuania": "🇱🇹", "luxembourg": "🇱🇺", "macao": "🇲🇴",
        "macau": "🇲🇴", "madagascar": "🇲🇬", "malawi": "🇲🇼", "malaysia": "🇲🇾", "maldives": "🇲🇻",
        "mali": "🇲🇱", "malta": "🇲🇹", "marshall islands": "🇲🇭", "mauritania": "🇲🇷", "mauritius": "🇲🇺",
        "mexico": "🇲🇽", "micronesia": "🇫🇲", "moldova": "🇲🇩", "monaco": "🇲🇨", "mongolia": "🇲🇳",
        "montenegro": "🇲🇪", "morocco": "🇲🇦", "mozambique": "🇲🇿", "myanmar": "🇲🇲", "burma": "🇲🇲",
        "namibia": "🇳🇦", "nauru": "🇳🇷", "nepal": "🇳🇵", "netherlands": "🇳🇱", "new zealand": "🇳🇿",
        "nicaragua": "🇳🇮", "niger": "🇳🇪", "nigeria": "🇳🇬", "north korea": "🇰🇵", "north macedonia": "🇲🇰",
        "macedonia": "🇲🇰", "norway": "🇳🇴", "oman": "🇴🇲", "pakistan": "🇵🇰", "palau": "🇵🇼",
        "palestine": "🇵🇸", "panama": "🇵🇦", "papua new guinea": "🇵🇬", "paraguay": "🇵🇾", "peru": "🇵🇪",
        "philippines": "🇵🇭", "poland": "🇵🇱", "portugal": "🇵🇹", "puerto rico": "🇵🇷", "qatar": "🇶🇦",
        "romania": "🇷🇴", "russia": "🇷🇺", "russian federation": "🇷🇺", "rwanda": "🇷🇼", "saint kitts and nevis": "🇰🇳",
        "saint lucia": "🇱🇨", "saint vincent and the grenadines": "🇻🇨", "samoa": "🇼🇸", "san marino": "🇸🇲", "sao tome and principe": "🇸🇹",
        "saudi arabia": "🇸🇦", "scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "senegal": "🇸🇳", "serbia": "🇷🇸", "seychelles": "🇸🇨",
        "sierra leone": "🇸🇱", "singapore": "🇸🇬", "slovakia": "🇸🇰", "slovenia": "🇸🇮", "solomon islands": "🇸🇧",
        "somalia": "🇸🇴", "south africa": "🇿🇦", "south korea": "🇰🇷", "south sudan": "🇸🇸", "spain": "🇪🇸",
        "sri lanka": "🇱🇰", "sudan": "🇸🇩", "suriname": "🇸🇷", "sweden": "🇸🇪", "switzerland": "🇨🇭",
        "syria": "🇸🇾", "taiwan": "🇹🇼", "tajikistan": "🇹🇯", "tanzania": "🇹🇿", "thailand": "🇹🇭",
        "timor-leste": "🇹🇱", "togo": "🇹🇬", "tonga": "🇹🇴", "trinidad and tobago": "🇹🇹", "tunisia": "🇹🇳",
        "turkey": "🇹🇷", "türkiye": "🇹🇷", "turkmenistan": "🇹🇲", "tuvalu": "🇹🇻", "uganda": "🇺🇬",
        "ukraine": "🇺🇦", "united arab emirates": "🇦🇪", "uae": "🇦🇪", "united kingdom": "🇬🇧", "uk": "🇬🇧",
        "great britain": "🇬🇧", "britain": "🇬🇧", "united states": "🇺🇸", "usa": "🇺🇸", "us": "🇺🇸",
        "uruguay": "🇺🇾", "uzbekistan": "🇺🇿", "vanuatu": "🇻🇺", "vatican city": "🇻🇦", "venezuela": "🇻🇪",
        "vietnam": "🇻🇳", "wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "yemen": "🇾🇪", "zambia": "🇿🇲", "zimbabwe": "🇿🇼"
    };

    /**
     * Core Application Class
     */
    class XLocationPatcher {
        constructor() {
            this.cache = new Map();
            this.requestQueue = [];
            this.activeRequests = 0;
            this.lastRequestTime = 0;
            this.rateLimitReset = 0;
            this.headers = null;
            this.processingSet = new Set();
            this.observer = null;
            this.isEnabled = true;

            this.init();
        }

        init() {
            console.log(`🚀 X Account Location v${CONFIG.VERSION} initializing...`);
            this.loadSettings();
            this.loadCache();
            this.setupInterceptors();
            this.exposeAPI();
            
            // Inject styles and start observing when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.injectStyles();
                    this.startObserver();
                });
            } else {
                this.injectStyles();
                this.startObserver();
            }

            // Periodic cache save
            setInterval(() => this.saveCache(), 30000);
        }

        /**
         * Network Interception & Header Capture
         */
        setupInterceptors() {
            const self = this;
            
            // Intercept Fetch
            const originalFetch = window.fetch;
            window.fetch = function(url, options) {
                if (typeof url === 'string' && url.includes('x.com/i/api/graphql') && options?.headers) {
                    self.captureHeaders(options.headers);
                }
                return originalFetch.apply(this, arguments);
            };

            // Intercept XHR
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

            XMLHttpRequest.prototype.open = function(method, url) {
                this._url = url;
                return originalOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
                if (!this._headers) this._headers = {};
                this._headers[header] = value;
                return originalSetHeader.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function() {
                if (this._url?.includes('x.com/i/api/graphql') && this._headers) {
                    self.captureHeaders(this._headers);
                }
                return originalSend.apply(this, arguments);
            };
        }

        captureHeaders(headers) {
            if (this.headers) return; // Already captured
            
            const headerObj = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
            
            // Validate we have auth headers
            if (headerObj.authorization || headerObj['authorization']) {
                this.headers = headerObj;
                console.log('✅ X API Headers captured successfully');
            }
        }

        getFallbackHeaders() {
            const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
                const [key, value] = cookie.split('=');
                acc[key] = value;
                return acc;
            }, {});

            if (!cookies.ct0) return null;

            return {
                'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                'x-csrf-token': cookies.ct0,
                'x-twitter-active-user': 'yes',
                'x-twitter-auth-type': 'OAuthSession',
                'content-type': 'application/json'
            };
        }

        /**
         * Data Management
         */
        loadSettings() {
            try {
                const stored = localStorage.getItem('x_location_enabled');
                this.isEnabled = stored !== null ? JSON.parse(stored) : true;
            } catch (e) {
                console.error('Failed to load settings', e);
            }
        }

        loadCache() {
            try {
                const raw = localStorage.getItem(CONFIG.CACHE_KEY);
                if (!raw) return;
                
                const parsed = JSON.parse(raw);
                const now = Date.now();
                let count = 0;

                Object.entries(parsed).forEach(([key, data]) => {
                    if (data.expiry > now) {
                        this.cache.set(key, data.value);
                        count++;
                    }
                });
                console.log(`📦 Loaded ${count} cached entries`);
            } catch (e) {
                console.error('Cache load failed', e);
                localStorage.removeItem(CONFIG.CACHE_KEY);
            }
        }

        saveCache() {
            try {
                const now = Date.now();
                const expiry = now + CONFIG.CACHE_EXPIRY;
                const exportData = {};
                
                this.cache.forEach((value, key) => {
                    exportData[key] = { value, expiry };
                });
                
                localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(exportData));
            } catch (e) {
                console.error('Cache save failed', e);
            }
        }

        /**
         * API Interaction
         */
        async fetchUserInfo(screenName) {
            // Check cache first
            if (this.cache.has(screenName)) {
                return this.cache.get(screenName);
            }

            // Queue request
            return new Promise((resolve, reject) => {
                this.requestQueue.push({ screenName, resolve, reject });
                this.processQueue();
            });
        }

        async processQueue() {
            if (this.activeRequests >= CONFIG.API.MAX_CONCURRENT || this.requestQueue.length === 0) return;

            // Rate limit check
            const now = Date.now();
            if (this.rateLimitReset > now) {
                const wait = this.rateLimitReset - now;
                setTimeout(() => this.processQueue(), Math.min(wait, 60000));
                return;
            }

            const timeSinceLast = now - this.lastRequestTime;
            if (timeSinceLast < CONFIG.API.MIN_INTERVAL) {
                setTimeout(() => this.processQueue(), CONFIG.API.MIN_INTERVAL - timeSinceLast);
                return;
            }

            // Execute request
            const request = this.requestQueue.shift();
            this.activeRequests++;
            this.lastRequestTime = Date.now();

            try {
                const result = await this.executeApiCall(request.screenName);
                this.cache.set(request.screenName, result);
                request.resolve(result);
            } catch (error) {
                request.reject(error);
            } finally {
                this.activeRequests--;
                this.processQueue();
            }
        }

        async executeApiCall(screenName) {
            let headers = this.headers;

            if (!headers) {
                // Try fallback
                headers = this.getFallbackHeaders();
                
                if (!headers) {
                    // Wait for headers
                    await new Promise(r => setTimeout(r, 2000));
                    headers = this.headers || this.getFallbackHeaders();
                    if (!headers) throw new Error('No API headers captured');
                } else {
                    console.log('⚠️ Using fallback headers');
                }
            }

            const variables = encodeURIComponent(JSON.stringify({ screenName }));
            const url = `https://x.com/i/api/graphql/${CONFIG.API.QUERY_ID}/AboutAccountQuery?variables=${variables}`;

            const requestHeaders = { ...headers };
            // Force English for consistent country names
            requestHeaders['accept-language'] = 'en-US,en;q=0.9';

            const response = await fetch(url, {
                headers: requestHeaders,
                method: 'GET',
                mode: 'cors',
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 429) {
                    const reset = response.headers.get('x-rate-limit-reset');
                    this.rateLimitReset = reset ? parseInt(reset) * 1000 : Date.now() + 60000;
                    throw new Error('Rate limited');
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const profile = data?.data?.user_result_by_screen_name?.result?.about_profile;
            
            return {
                location: profile?.account_based_in || null,
                device: profile?.source || null
            };
        }

        /**
         * UI & DOM Manipulation
         */
        injectStyles() {
            if (document.getElementById(CONFIG.STYLES.SHIMMER_ID)) return;
            
            const style = document.createElement('style');
            style.id = CONFIG.STYLES.SHIMMER_ID;
            style.textContent = `
                @keyframes x-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                .x-flag-shimmer {
                    display: inline-block; width: 20px; height: 16px; margin: 0 4px; vertical-align: middle;
                    border-radius: 2px;
                    background: linear-gradient(90deg, rgba(113,118,123,0.2) 25%, rgba(113,118,123,0.4) 50%, rgba(113,118,123,0.2) 75%);
                    background-size: 200% 100%;
                    animation: x-shimmer 1.5s infinite;
                }
                .x-info-badge {
                    margin: 0 4px; display: inline-flex; align-items: center; vertical-align: middle; gap: 4px;
                    font-family: "Twemoji Mozilla", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", sans-serif;
                    font-size: 14px; opacity: 0.8; transition: all 0.2s; cursor: help;
                }
                .x-info-badge:hover { opacity: 1; transform: scale(1.1); }
            `;
            document.head.appendChild(style);
        }

        getFlagEmoji(countryName) {
            if (!countryName) return null;
            return COUNTRY_FLAGS[countryName.trim().toLowerCase()] || '🌍';
        }

        getDeviceEmoji(deviceString) {
            if (!deviceString) return null;
            const d = deviceString.toLowerCase();
            if (d.includes('android') || d.includes('iphone') || d.includes('mobile')) return '📱';
            if (d.includes('mac') || d.includes('linux') || d.includes('windows')) return '💻';
            if (d.includes('web')) return '🌐';
            return '📱';
        }

        async processElement(element) {
            if (element.dataset.xProcessed) return;
            
            const screenName = this.extractUsername(element);
            if (!screenName || this.processingSet.has(screenName)) return;

            element.dataset.xProcessed = 'true';
            this.processingSet.add(screenName);

            // Insert shimmer
            const shimmer = document.createElement('span');
            shimmer.className = 'x-flag-shimmer';
            const insertionPoint = this.findInsertionPoint(element, screenName);
            if (insertionPoint) insertionPoint.target.insertBefore(shimmer, insertionPoint.ref);

            try {
                const info = await this.fetchUserInfo(screenName);
                shimmer.remove();

                if (info.location || info.device) {
                    const badge = document.createElement('span');
                    badge.className = 'x-info-badge';
                    
                    let content = '';
                    if (info.location) {
                        const flag = this.getFlagEmoji(info.location);
                        if (flag) content += `<span title="${info.location}">${flag}</span>`;
                    }
                    
                    // Fallback device detection if API returns null (common for some accounts)
                    let device = info.device;
                    if (!device) {
                        const ua = navigator.userAgent.toLowerCase();
                        if (ua.includes('android')) device = 'Android';
                        else if (ua.includes('iphone')) device = 'iOS';
                        else if (ua.includes('windows')) device = 'Windows';
                        else device = 'Web';
                    }

                    if (device) {
                        const emoji = this.getDeviceEmoji(device);
                        content += `<span title="Connected via: ${device}">${emoji}</span>`;
                    }

                    badge.innerHTML = content;
                    
                    // Re-find insertion point as DOM might have changed
                    const finalPoint = this.findInsertionPoint(element, screenName);
                    if (finalPoint) finalPoint.target.insertBefore(badge, finalPoint.ref);
                }
            } catch (e) {
                console.debug(`Failed to process ${screenName}`, e);
                shimmer.remove();
            } finally {
                this.processingSet.delete(screenName);
            }
        }

        extractUsername(element) {
            // Try to find the username link
            const link = element.querySelector('a[href^="/"]');
            if (!link) return null;

            const href = link.getAttribute('href');
            const match = href.match(/^\/([^/]+)$/);
            if (!match) return null;

            const username = match[1];
            const invalid = ['home', 'explore', 'notifications', 'messages', 'search', 'settings'];
            if (invalid.includes(username)) return null;

            return username;
        }

        findInsertionPoint(container, screenName) {
            // Look for the handle (@username)
            const links = Array.from(container.querySelectorAll('a'));
            const handleLink = links.find(l => l.textContent.trim().toLowerCase() === `@${screenName.toLowerCase()}`);
            
            if (handleLink) {
                // Insert after the handle
                return { target: handleLink.parentNode.parentNode, ref: handleLink.parentNode.nextSibling };
            }

            // Fallback: Try to find the name container
            const nameLink = container.querySelector(`a[href="/${screenName}"]`);
            if (nameLink) {
                return { target: nameLink.parentNode, ref: nameLink.nextSibling };
            }

            return null;
        }

        startObserver() {
            this.observer = new MutationObserver((mutations) => {
                if (!this.isEnabled) return;
                
                let shouldProcess = false;
                for (const m of mutations) {
                    if (m.addedNodes.length) {
                        shouldProcess = true;
                        break;
                    }
                }

                if (shouldProcess) {
                    this.scanPage();
                }
            });

            this.observer.observe(document.body, { childList: true, subtree: true });
            this.scanPage(); // Initial scan
        }

        scanPage() {
            const elements = document.querySelectorAll(CONFIG.SELECTORS.USERNAME);
            elements.forEach(el => this.processElement(el));
        }

        /**
         * Public API
         */
        getCacheInfo() {
            const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
                key,
                value
            }));
            return { size: this.cache.size, entries };
        }

        exposeAPI() {
            const api = {
                clearCache: () => {
                    this.cache.clear();
                    localStorage.removeItem(CONFIG.CACHE_KEY);
                    console.log('🧹 Cache cleared');
                },
                getCacheInfo: () => {
                    const info = this.getCacheInfo();
                    console.log('Cache info:', info);
                    return info;
                },
                toggle: () => {
                    this.isEnabled = !this.isEnabled;
                    localStorage.setItem('x_location_enabled', this.isEnabled);
                    console.log(`Extension ${this.isEnabled ? 'enabled' : 'disabled'}`);
                },
                debug: () => {
                    console.log('Cache Size:', this.cache.size);
                    console.log('Queue Length:', this.requestQueue.length);
                    console.log('Active Requests:', this.activeRequests);
                }
            };

            // In extension context (MAIN world), we can just attach to window
            // But we should check if we need cloneInto (Firefox extension content script in MAIN world might still need it?)
            // Actually, in MAIN world, we share the JS context, so direct assignment usually works.
            // But let's keep the safe check.
            
            if (typeof cloneInto === 'function') {
                try {
                    window.XFlagScript = cloneInto(api, window, { cloneFunctions: true });
                } catch(e) {
                    window.XFlagScript = api;
                }
            } else {
                window.XFlagScript = api;
            }
        }
    }

    // Instantiate
    new XLocationPatcher();

})();