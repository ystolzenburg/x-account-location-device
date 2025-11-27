/**
 * Cloud Community Cache Client
 * Handles communication with the Cloudflare Workers API for shared cache
 */

import { STORAGE_KEYS, CLOUD_CACHE_CONFIG } from '../shared/constants.js';
import browserAPI from '../shared/browser-api.js';

class CloudCacheClient {
    constructor() {
        this.enabled = false;
        this.apiUrl = CLOUD_CACHE_CONFIG.API_URL;
        this.lookupBatch = new Set();
        this.lookupBatchTimeout = null;
        this.lookupBatchResolvers = []; // Array of resolve functions waiting for batch
        this.contributionQueue = new Map(); // username -> data
        this.contributeTimeout = null;
        this.requestCount = 0;
        this.requestWindowStart = Date.now();
        this.stats = {
            lookups: 0,
            hits: 0,
            misses: 0,
            contributions: 0,
            errors: 0
        };
    }

    /**
     * Initialize the cloud cache client
     */
    async init() {
        // Load enabled state from storage
        const result = await browserAPI.storage.local.get([
            STORAGE_KEYS.CLOUD_CACHE_ENABLED,
            STORAGE_KEYS.CLOUD_STATS
        ]);
        
        this.enabled = result[STORAGE_KEYS.CLOUD_CACHE_ENABLED] === true;
        
        if (result[STORAGE_KEYS.CLOUD_STATS]) {
            this.stats = { ...this.stats, ...result[STORAGE_KEYS.CLOUD_STATS] };
        }
        
        console.log(`☁️ Cloud Cache: ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }

    /**
     * Set cloud cache enabled state
     */
    async setEnabled(enabled) {
        this.enabled = enabled;
        await browserAPI.storage.local.set({
            [STORAGE_KEYS.CLOUD_CACHE_ENABLED]: enabled
        });
        console.log(`☁️ Cloud Cache: ${enabled ? 'enabled' : 'disabled'}`);
        return enabled;
    }

    /**
     * Get current enabled state
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Save statistics to storage
     */
    async saveStats() {
        await browserAPI.storage.local.set({
            [STORAGE_KEYS.CLOUD_STATS]: this.stats
        });
    }

    /**
     * Check rate limit
     */
    checkRateLimit() {
        const now = Date.now();
        
        // Reset window if minute has passed
        if (now - this.requestWindowStart > 60000) {
            this.requestCount = 0;
            this.requestWindowStart = now;
        }
        
        if (this.requestCount >= CLOUD_CACHE_CONFIG.MAX_REQUESTS_PER_MINUTE) {
            return false;
        }
        
        this.requestCount++;
        return true;
    }

    /**
     * Lookup users in cloud cache
     * Returns map of username -> data (or null for misses)
     */
    async lookup(usernames) {
        if (!this.enabled || !usernames || usernames.length === 0) {
            return new Map();
        }

        // Add to batch
        for (const username of usernames) {
            this.lookupBatch.add(username.toLowerCase());
        }

        // Return batched promise - all callers share the same batch result
        return new Promise((resolve) => {
            // Add this resolver to the list of waiting callers
            this.lookupBatchResolvers.push(resolve);
            
            // Reset the batch timer (debounce)
            if (this.lookupBatchTimeout) {
                clearTimeout(this.lookupBatchTimeout);
            }
            
            this.lookupBatchTimeout = setTimeout(() => {
                this.executeBatchedLookup();
            }, CLOUD_CACHE_CONFIG.BATCH_DELAY_MS);
        });
    }

    /**
     * Execute batched lookup and resolve all waiting callers
     */
    async executeBatchedLookup() {
        const batch = Array.from(this.lookupBatch);
        const resolvers = [...this.lookupBatchResolvers];
        
        // Clear batch state
        this.lookupBatch.clear();
        this.lookupBatchResolvers = [];
        this.lookupBatchTimeout = null;

        if (batch.length === 0) {
            // Resolve all callers with empty result
            for (const resolve of resolvers) {
                resolve(new Map());
            }
            return;
        }

        try {
            const results = await this.fetchLookup(batch);
            // Resolve ALL waiting callers with the same results
            for (const resolve of resolvers) {
                resolve(results);
            }
        } catch (error) {
            console.error('☁️ Cloud lookup error:', error);
            this.stats.errors++;
            // Resolve all callers with empty result on error
            for (const resolve of resolvers) {
                resolve(new Map());
            }
        }
    }

    /**
     * Fetch lookup from cloud API
     */
    async fetchLookup(usernames) {
        if (!this.checkRateLimit()) {
            console.warn('☁️ Cloud cache rate limited (client-side)');
            return new Map();
        }

        this.stats.lookups++;
        const results = new Map();

        // Split into batches if needed
        const batches = [];
        for (let i = 0; i < usernames.length; i += CLOUD_CACHE_CONFIG.BATCH_SIZE) {
            batches.push(usernames.slice(i, i + CLOUD_CACHE_CONFIG.BATCH_SIZE));
        }

        for (const batch of batches) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    CLOUD_CACHE_CONFIG.LOOKUP_TIMEOUT_MS
                );

                const response = await fetch(
                    `${this.apiUrl}/lookup?users=${batch.join(',')}`,
                    {
                        method: 'GET',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json'
                        }
                    }
                );

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                // Process results
                if (data.results) {
                    for (const [username, info] of Object.entries(data.results)) {
                        this.stats.hits++;
                        results.set(username.toLowerCase(), {
                            location: info.l,
                            device: info.d,
                            locationAccurate: info.a !== false,
                            fromCloud: true,
                            timestamp: info.t * 1000 // Convert seconds to ms
                        });
                    }
                }

                // Track misses
                if (data.misses) {
                    for (const username of data.misses) {
                        this.stats.misses++;
                    }
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn('☁️ Cloud lookup timed out');
                } else {
                    console.error('☁️ Cloud lookup failed:', error.message);
                }
                this.stats.errors++;
            }
        }

        // Save stats periodically
        this.saveStats();

        return results;
    }

    /**
     * Contribute data to cloud cache
     */
    async contribute(username, data) {
        if (!this.enabled || !username || !data) {
            return;
        }

        // Add to contribution queue
        this.contributionQueue.set(username.toLowerCase(), {
            l: data.location,
            d: data.device,
            a: data.locationAccurate
        });

        // Debounce contributions
        if (this.contributeTimeout) {
            clearTimeout(this.contributeTimeout);
        }

        this.contributeTimeout = setTimeout(() => {
            this.flushContributions();
        }, CLOUD_CACHE_CONFIG.CONTRIBUTE_DELAY_MS);

        // Flush if batch is full
        if (this.contributionQueue.size >= CLOUD_CACHE_CONFIG.CONTRIBUTE_BATCH_SIZE) {
            this.flushContributions();
        }
    }

    /**
     * Flush pending contributions to cloud
     */
    async flushContributions() {
        if (this.contributionQueue.size === 0) {
            return;
        }

        if (this.contributeTimeout) {
            clearTimeout(this.contributeTimeout);
            this.contributeTimeout = null;
        }

        const entries = Object.fromEntries(this.contributionQueue);
        this.contributionQueue.clear();

        if (!this.checkRateLimit()) {
            console.warn('☁️ Contribution rate limited (client-side)');
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                CLOUD_CACHE_CONFIG.CONTRIBUTE_TIMEOUT_MS
            );

            const response = await fetch(`${this.apiUrl}/contribute`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ entries })
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                this.stats.contributions += data.accepted || Object.keys(entries).length;
                console.log(`☁️ Contributed ${Object.keys(entries).length} entries to cloud`);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('☁️ Contribution timed out');
            } else {
                console.error('☁️ Contribution failed:', error.message);
            }
            this.stats.errors++;
        }

        this.saveStats();
    }

    /**
     * Check if API URL is configured
     */
    isConfigured() {
        return this.apiUrl && !this.apiUrl.includes('YOUR_SUBDOMAIN');
    }

    /**
     * Bulk sync local cache entries to cloud
     * @param {Object} cacheEntries - Map of username -> data
     * @returns {Object} - { synced, skipped, errors }
     */
    async bulkSync(cacheEntries) {
        if (!this.enabled || !this.isConfigured()) {
            return { synced: 0, skipped: 0, errors: 0, message: 'Cloud cache not enabled' };
        }

        const entries = Object.entries(cacheEntries);
        if (entries.length === 0) {
            return { synced: 0, skipped: 0, errors: 0, message: 'No entries to sync' };
        }

        let synced = 0;
        let skipped = 0;
        let errors = 0;

        // Split into smaller batches for bulk sync (25 entries per batch to avoid timeouts)
        const batchSize = 25; // Smaller than normal to avoid timeouts
        const batches = [];
        
        for (let i = 0; i < entries.length; i += batchSize) {
            batches.push(entries.slice(i, i + batchSize));
        }

        console.log(`☁️ Bulk sync: ${entries.length} entries in ${batches.length} batches`);

        for (const batch of batches) {
            const batchEntries = {};
            
            for (const [username, data] of batch) {
                // Skip entries without valid location data
                if (!data || !data.location) {
                    skipped++;
                    continue;
                }

                batchEntries[username.toLowerCase()] = {
                    l: data.location,
                    d: data.device || '',
                    a: data.locationAccurate !== false
                };
            }

            if (Object.keys(batchEntries).length === 0) {
                continue;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    10000 // 10 second timeout for bulk sync
                );

                const response = await fetch(`${this.apiUrl}/contribute`, {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ entries: batchEntries })
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const result = await response.json();
                    synced += result.accepted || Object.keys(batchEntries).length;
                    console.log(`☁️ Batch synced: ${Object.keys(batchEntries).length} entries`);
                } else {
                    const errText = await response.text();
                    console.error(`☁️ Batch failed (${response.status}):`, errText);
                    errors += Object.keys(batchEntries).length;
                }

            } catch (error) {
                console.error('☁️ Bulk sync batch error:', error.message);
                errors += Object.keys(batchEntries).length;
            }

            // Longer delay between batches to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Don't save stats here since we didn't modify contribution count

        console.log(`☁️ Bulk sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

        return {
            synced,
            skipped,
            errors,
            message: `Synced ${synced} entries to cloud`
        };
    }

    /**
     * Fetch server statistics (total entries in cloud cache)
     */
    async fetchServerStats() {
        if (!this.isConfigured()) {
            return null;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.apiUrl}/stats`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                totalEntries: data.totalEntries || 0,
                totalContributions: data.totalContributions || 0,
                lastUpdated: data.lastUpdated || null
            };
        } catch (error) {
            console.warn('☁️ Failed to fetch server stats:', error.message);
            return null;
        }
    }
}

// Singleton instance
const cloudCache = new CloudCacheClient();
export default cloudCache;