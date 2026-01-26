# TikTok Signature Generator

![NPM](https://img.shields.io/npm/l/tiktok-signature.svg?style=for-the-badge) ![npm](https://img.shields.io/npm/v/tiktok-signature.svg?style=for-the-badge)

Generate valid **X-Bogus** and **X-Gnarly** signatures for TikTok API requests. This service uses a headless browser with TikTok's own SDK to generate authentic signatures that work reliably.

> **Free & Open Source**: While many services asks for money for TikTok signature generation, this project provides a fully functional solution **completely free**. If you find it useful, consider [buying me a coffee](https://www.buymeacoffee.com/carcabot) ☕

## Features

- Generates valid X-Bogus and X-Gnarly signatures
- Uses TikTok's official SDK (injected locally for reliability)
- Supports proxy configuration for IP rotation
- Queue system handles concurrent requests safely
- `/signature` endpoint for scalable external requests (recommended)
- `/fetch` endpoint as fallback (browser-based, 100% reliable)
- Docker support for easy deployment
- Benchmark tool for performance testing

## Important: Proxy Recommendation

For production use, **residential proxies are highly recommended** when making external requests to TikTok. TikTok actively blocks datacenter IPs and implements strict rate limiting.

**Why residential proxies?**

- Datacenter IPs are often blocked or heavily rate-limited by TikTok
- Residential IPs appear as regular users and have higher success rates
- Rotating residential proxies help avoid IP-based bans

**Recommended proxy providers:**

- Bright Data (formerly Luminati)
- Oxylabs
- Smartproxy
- IPRoyal

Configure your proxy in `.env`:

```bash
PROXY_ENABLED=true
PROXY_HOST=your-residential-proxy.com:port
PROXY_USER=username
PROXY_PASS=password
```

Without proxies, you may experience:

- Empty responses from TikTok
- Rate limiting (HTTP 429)
- IP blocks after high volume requests

## <a href="https://www.buymeacoffee.com/carcabot" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-blue.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/carcabot/tiktok-signature.git
cd tiktok-signature

# Install dependencies
npm install

# Install browser (Chromium)
npx puppeteer browsers install chromium

# Copy environment config
cp .env.example .env

# Start the server
npm start
```

### Using Docker

```bash
# Build and run with Docker Compose
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## API Endpoints

### POST /signature (Recommended)

Generate a signed URL with X-Bogus and X-Gnarly parameters. **This is the recommended endpoint for scalability** - your application makes the actual HTTP requests to TikTok, allowing you to handle rate limiting, retries, and parallel requests.

**Request:**

```bash
curl -X POST http://localhost:8080/signature \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/api/post/item_list/?secUid=MS4wLjABAAAA...&cursor=0&count=30"}'
```

**Response:**

```json
{
  "status": "ok",
  "data": {
    "signed_url": "https://www.tiktok.com/api/post/item_list/?...&X-Bogus=DFSzswVL...&X-Gnarly=M8tHhQ2H...",
    "x-bogus": "DFSzswVLXdxANGP5CtmFF2lUrn/4",
    "x-gnarly": "M8tHhQ2H0Kh/XPpeEgkaXo20D9uW...",
    "device-id": "7520531026079925774",
    "cookies": "tt_webid=...; tt_chain_token=...",
    "navigator": {
      "user_agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36..."
    }
  }
}
```

### POST /fetch (Fallback)

Fetch data directly through the browser. This endpoint makes the actual API request through the browser session, bypassing TikTok's bot detection.

**Use this only as a fallback** when external requests with signed URLs fail. This endpoint is slower and less scalable because each request goes through the browser.

**Request:**

```bash
curl -X POST http://localhost:8080/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/api/post/item_list/?secUid=MS4wLjABAAAA..."}'
```

**Response:**

```json
{
  "status": "ok",
  "httpStatus": 200,
  "data": {
    "itemList": [...],
    "cursor": 30,
    "hasMore": true
  }
}
```

### GET /health

Check server health and status.

```bash
curl http://localhost:8080/health
```

**Response:**

```json
{
  "status": "ok",
  "ready": true,
  "initMethod": "local-sdk",
  "generationCount": 150,
  "queueLength": 0,
  "proxyEnabled": false
}
```

### GET /restart

Restart the browser session (useful if signatures stop working).

```bash
curl http://localhost:8080/restart
```

## Configuration

### Environment Variables

| Variable                    | Default | Description                                          |
| --------------------------- | ------- | ---------------------------------------------------- |
| `PORT`                      | `8080`  | Server port                                          |
| `PROXY_ENABLED`             | `false` | Enable proxy support                                 |
| `PROXY_HOST`                | -       | Proxy host and port (e.g., `proxy.example.com:8080`) |
| `PROXY_USER`                | -       | Proxy username                                       |
| `PROXY_PASS`                | -       | Proxy password                                       |
| `PUPPETEER_EXECUTABLE_PATH` | auto    | Custom Chrome/Chromium path                          |

### Example .env file

```bash
PORT=8080
PROXY_ENABLED=true
PROXY_HOST=proxy.example.com:8080
PROXY_USER=your_username
PROXY_PASS=your_password
```

## Usage Examples

### Node.js

```javascript
async function getTikTokPosts(secUid) {
  const baseUrl =
    `https://www.tiktok.com/api/post/item_list/?` +
    `aid=1988&app_name=tiktok_web&device_platform=web_pc&` +
    `secUid=${encodeURIComponent(secUid)}&cursor=0&count=30`;

  // Get signed URL
  const signResponse = await fetch("http://localhost:8080/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: baseUrl }),
  });

  const { data } = await signResponse.json();

  // Make request to TikTok
  const response = await fetch(data.signed_url, {
    headers: {
      "User-Agent": data.navigator.user_agent,
      Cookie: data.cookies,
    },
  });

  return response.json();
}
```

### PHP with Guzzle

```php
<?php
use GuzzleHttp\Client;

function getTikTokPosts(string $secUid): array
{
    $signatureClient = new Client(['base_uri' => 'http://localhost:8080']);

    $baseUrl = 'https://www.tiktok.com/api/post/item_list/?' . http_build_query([
        'aid' => '1988',
        'app_name' => 'tiktok_web',
        'device_platform' => 'web_pc',
        'secUid' => $secUid,
        'cursor' => 0,
        'count' => 30
    ]);

    // Get signed URL
    $response = $signatureClient->post('/signature', [
        'json' => ['url' => $baseUrl]
    ]);

    $data = json_decode($response->getBody(), true)['data'];

    // Make request to TikTok
    $tiktokClient = new Client();
    $response = $tiktokClient->get($data['signed_url'], [
        'headers' => [
            'User-Agent' => $data['navigator']['user_agent'],
            'Cookie' => $data['cookies']
        ]
    ]);

    return json_decode($response->getBody(), true);
}
```

### Python

```python
import requests

def get_tiktok_posts(sec_uid: str) -> dict:
    base_url = f"https://www.tiktok.com/api/post/item_list/?" \
               f"aid=1988&app_name=tiktok_web&device_platform=web_pc&" \
               f"secUid={sec_uid}&cursor=0&count=30"

    # Get signed URL
    sign_response = requests.post(
        'http://localhost:8080/signature',
        json={'url': base_url}
    )
    data = sign_response.json()['data']

    # Make request to TikTok
    response = requests.get(
        data['signed_url'],
        headers={
            'User-Agent': data['navigator']['user_agent'],
            'Cookie': data['cookies']
        }
    )

    return response.json()
```

### Using /fetch endpoint (100% reliable)

If external requests fail, use the `/fetch` endpoint which makes the request through the browser:

```javascript
async function getTikTokPostsReliable(secUid) {
  const baseUrl =
    `https://www.tiktok.com/api/post/item_list/?` +
    `aid=1988&app_name=tiktok_web&device_platform=web_pc&` +
    `secUid=${encodeURIComponent(secUid)}&cursor=0&count=30`;

  const response = await fetch("http://localhost:8080/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: baseUrl }),
  });

  const { data } = await response.json();
  return data; // Contains itemList directly
}
```

## Benchmark

Test signature generation performance:

```bash
# Run benchmark (100 requests, sequential)
npm run benchmark

# Custom benchmark
node benchmark.mjs --requests=500 --concurrency=1

# Benchmark /fetch endpoint
node benchmark.mjs --requests=50 --endpoint=fetch
```

**Example output:**

```
============================================================
TikTok Signature Server - Benchmark
============================================================
Host:        http://localhost:8080
Endpoint:    /signature
Requests:    100
Concurrency: 1
============================================================

Server ready (init method: local-sdk)

Running benchmark...

[####################] 100% (100/100) - 100 ok, 0 failed

============================================================
RESULTS
============================================================

Throughput:
  Total requests:     100
  Successful:         100 (100.0%)
  Failed:             0
  Total time:         8.42s
  Requests/second:    11.88
  Requests/minute:    713

Latency:
  Average:            84ms
  Min:                75ms
  Max:                156ms
  P50 (median):       81ms
  P95:                108ms
  P99:                145ms
```

## Docker Deployment

### docker-compose.yml

```yaml
version: "3.8"
services:
  tiktok-signature:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - PROXY_ENABLED=false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Running with Docker

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Production Best Practices

### 1. Use Residential Proxies

TikTok blocks datacenter IPs aggressively. For production workloads:

```bash
# .env configuration
PROXY_ENABLED=true
PROXY_HOST=residential-proxy.example.com:8080
PROXY_USER=your_username
PROXY_PASS=your_password
```

### 2. Use /signature Endpoint (Not /fetch)

The `/signature` endpoint is designed for scalability:

- Signature generation: ~80ms (handled by signature server)
- HTTP requests to TikTok: handled by your application (can be parallelized)

```javascript
// Good: Scalable approach
const signedData = await getSignedUrl(url);
const response = await fetch(signedData.signed_url, { headers: {...} });

// Avoid in production: Not scalable
const response = await fetch('http://localhost:8080/fetch', {...});
```

### 3. Implement Rate Limiting

TikTok has rate limits. Implement delays between requests:

```javascript
// Add delay between requests
await new Promise((r) => setTimeout(r, 1000)); // 1 second delay
```

### 4. Handle Failures Gracefully

```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const signedData = await getSignedUrl(url);
      const response = await fetch(signedData.signed_url, {...});
      if (response.ok) return response.json();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1))); // Exponential backoff
    }
  }
}
```

### 5. Monitor Health

Periodically check server health and restart if needed:

```bash
# Health check
curl http://localhost:8080/health

# Restart browser if issues occur
curl http://localhost:8080/restart
```

## Troubleshooting

### Signatures not working

1. **Restart the browser session:**

   ```bash
   curl http://localhost:8080/restart
   ```

2. **Use the /fetch endpoint:** If external requests with signed URLs fail, use `/fetch` which makes requests through the browser.

3. **Check SDK initialization:**
   ```bash
   curl http://localhost:8080/health
   ```
   Ensure `ready: true` and `initMethod: "local-sdk"`.

### Browser won't start

- Ensure Chromium is installed: `npx puppeteer browsers install chromium`
- Check `PUPPETEER_EXECUTABLE_PATH` is set correctly
- On Linux, ensure required libraries are installed

### Proxy not working

- Verify proxy credentials are correct
- Check proxy host format: `host:port` (no `http://` prefix)
- Ensure `PROXY_ENABLED=true` is set

## Project Structure

```
tiktok-signature/
├── server.mjs          # Main server (new implementation)
├── benchmark.mjs       # Performance testing tool
├── javascript/
│   └── webmssdk_5.1.3.js  # TikTok SDK for signature generation
├── examples/           # Usage examples
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Architecture

The server uses Puppeteer with a stealth plugin to maintain a persistent browser session. TikTok's SDK is injected locally before page load, ensuring reliable signature generation without depending on TikTok's CDN.

**How it works:**

1. Browser initializes and loads TikTok with local SDK injection
2. SDK intercepts fetch requests and adds X-Bogus/X-Gnarly signatures
3. `/signature` endpoint triggers a fetch, captures the signed URL, and returns it
4. Your application uses the signed URL to make requests to TikTok

**Scalability:**

- The signature server only handles signature generation (fast, ~80ms per request)
- Your application handles HTTP requests to TikTok (can be parallelized, retried, etc.)
- Use residential proxies for your external requests to avoid IP blocks

## <a href="https://www.buymeacoffee.com/carcabot" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-blue.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original author: CarcaBot
- Contributors: See [contributors list](https://github.com/carcabot/tiktok-signature/contributors)

---

**Note**: This service is for educational and research purposes. Ensure compliance with TikTok's Terms of Service when using this tool.
