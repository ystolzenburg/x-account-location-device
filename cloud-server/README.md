# X-Posed Community Cloud Cache Server

This Cloudflare Worker provides a shared cache for location/device data, allowing X-Posed users to share lookups and reduce API calls.

## Features

- **Shared Cache**: All opted-in users share location data
- **Fast Global Access**: Sub-50ms lookups via Cloudflare's edge network
- **Privacy-Focused**: Only username → location/device mappings, no personal data
- **Auto-Expiring**: Entries expire after 2 weeks
- **Free Tier Friendly**: Works within Cloudflare's free tier limits

## Deployment Guide

### Prerequisites

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
2. [Node.js](https://nodejs.org/) installed (v16+)
3. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Step 1: Install Wrangler

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This opens a browser window to authenticate with your Cloudflare account.

### Step 3: Create KV Namespace

```bash
wrangler kv:namespace create "CACHE_KV"
```

This will output something like:
```
🌀 Creating namespace with title "x-posed-cache-CACHE_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CACHE_KV", id = "abc123..." }
```

**Copy the `id` value** - you'll need it in the next step.

### Step 4: Configure wrangler.toml

Edit `wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID_HERE` with the ID from Step 3:

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "abc123..."  # Your actual ID here
```

### Step 5: Deploy

```bash
wrangler deploy
```

After deployment, you'll see your Worker URL:
```
Published x-posed-cache (1.23 sec)
  https://x-posed-cache.YOUR_SUBDOMAIN.workers.dev
```

**Copy this URL** - you'll need it for the extension configuration.

### Step 6: Test the Deployment

```bash
# Health check
curl https://x-posed-cache.YOUR_SUBDOMAIN.workers.dev/health

# Should return:
# {"status":"ok","timestamp":...}
```

## Configure the Extension

### Option A: For Personal Use

Edit `extension/src/shared/constants.js` and update the API URL:

```javascript
export const CLOUD_CACHE_CONFIG = {
    API_URL: 'https://x-posed-cache.YOUR_SUBDOMAIN.workers.dev',
    // ... rest of config
};
```

Then rebuild the extension:
```bash
cd extension && npm run build:chrome
```

### Option B: For Distribution

If you want others to use your server, they can:

1. Open the extension's background page console (`chrome://extensions` → X-Posed → "Service Worker")
2. Run: `chrome.storage.local.set({ x_cloud_api_url: 'https://your-worker-url.workers.dev' })`

## API Endpoints

### GET /lookup

Lookup users in the cache.

**Request:**
```
GET /lookup?users=user1,user2,user3
```

**Response:**
```json
{
  "results": {
    "user1": { "l": "United States", "d": "iPhone", "a": true, "t": 1705312200 },
    "user2": { "l": "Japan", "d": "Android", "a": true, "t": 1705312300 }
  },
  "misses": ["user3"],
  "count": 2
}
```

### POST /contribute

Contribute new entries to the cache.

**Request:**
```json
{
  "entries": {
    "user3": { "l": "Germany", "d": "Web", "a": true }
  }
}
```

**Response:**
```json
{
  "accepted": 1,
  "rejected": 0,
  "message": "Stored 1 entries"
}
```

### GET /stats

Get cache statistics.

**Response:**
```json
{
  "totalContributions": 15234,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1705312200000
}
```

## Cost Estimates

Cloudflare Workers free tier includes:
- 100,000 requests/day
- 1 GB KV storage
- 10 million KV reads/month
- 1 million KV writes/month

| Users | Daily Requests | Monthly | Estimated Cost |
|-------|---------------|---------|----------------|
| 100 | 1,000 | 30,000 | Free |
| 1,000 | 10,000 | 300,000 | Free |
| 5,000 | 50,000 | 1,500,000 | ~$5/month |
| 10,000 | 100,000 | 3,000,000 | ~$15/month |

## Data Structure

Each cache entry:
```json
{
  "l": "United States",  // Location (country)
  "d": "iPhone",         // Device
  "a": true,             // Location accurate (false = VPN detected)
  "t": 1705312200        // Timestamp (seconds since epoch)
}
```

Entries automatically expire after 2 weeks.

## Privacy Considerations

- **No IP logging**: Worker doesn't store requester IPs
- **Minimal data**: Only username → location/device mapping
- **No tracking**: No analytics or user identification
- **Auto-expiring**: Data deleted after 2 weeks
- **Opt-in only**: Users must explicitly enable sharing

## Security

- CORS enabled for browser extension access
- Input validation on all endpoints
- Rate limiting configurable
- No authentication required (public cache)

## Local Development

```bash
# Start local dev server
wrangler dev

# With local KV persistence
wrangler dev --persist
```

## Troubleshooting

### "KV namespace not found"
- Make sure you created the KV namespace: `wrangler kv:namespace create "CACHE_KV"`
- Verify the ID in `wrangler.toml` matches the created namespace

### "Worker not responding"
- Check deployment: `wrangler tail` to see live logs
- Verify the URL is correct

### "CORS errors in browser"
- The worker includes CORS headers by default
- Make sure you're using the correct worker URL

## License

Same as the main X-Posed extension - MIT License.