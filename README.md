# TikTok Signature Generator

![NPM](https://img.shields.io/npm/l/tiktok-signature.svg?style=for-the-badge) ![npm](https://img.shields.io/npm/v/tiktok-signature.svg?style=for-the-badge)

A production-ready TikTok signature generator service that provides API signature generation for TikTok API requests. This service uses Playwright to generate valid signatures required for TikTok API authentication.

## Features

- **Production-Ready**: Comprehensive error handling, logging, and monitoring
- **High Performance**: Optimized browser context reuse for faster signature generation
- **REST API**: Simple HTTP API for signature generation
- **Docker Support**: Easy deployment with Docker and Docker Compose
- **Health Monitoring**: Built-in health check and metrics endpoints
- **Comprehensive Tests**: Full test coverage with unit and integration tests
- **TypeScript Support**: Full ES modules support

## <a href="https://www.buymeacoffee.com/carcabot" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-blue.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [API Endpoints](#api-endpoints)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install tiktok-signature
```

Or clone the repository:

```bash
git clone https://github.com/carcabot/tiktok-signature.git
cd tiktok-signature
npm install
```

## Quick Start

### Start the Server

```bash
npm start
```

The server will start on port 8080 by default.

### Generate a Signature

```bash
curl -X POST \
  -H "Content-type: text/plain" \
  -d 'https://m.tiktok.com/api/post/item_list/?aid=1988&count=30' \
  http://localhost:8080/signature
```

## API Documentation

### POST /signature

Generate a signature for a TikTok API URL.

**Request:**
- Method: `POST`
- Content-Type: `text/plain`
- Body: TikTok API URL (string)

**Response:**
```json
{
  "status": "ok",
  "data": {
    "signature": "_02B4Z6wo00f01...",
    "verify_fp": "verify_knvz9j2k_...",
    "signed_url": "https://m.tiktok.com/api/...",
    "x-tt-params": "1BLhm+0j/AG2Dlsz3v4u4w==",
    "x-bogus": "1BLhm+0j/AG2Dlsz3v4u4w==",
    "navigator": {
      "deviceScaleFactor": 3,
      "user_agent": "Mozilla/5.0...",
      "browser_language": "en-US",
      "browser_platform": "MacIntel",
      "browser_name": "Mozilla",
      "browser_version": "5.0..."
    }
  },
  "metadata": {
    "processingTime": 234,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "requestCount": 150,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /metrics

Get server metrics and performance data.

**Response:**
```json
{
  "requests": {
    "total": 150,
    "rate": 0.042
  },
  "uptime": {
    "seconds": 3600,
    "startTime": "2024-01-01T00:00:00.000Z"
  },
  "memory": {
    "rss": 123456789,
    "heapTotal": 123456789,
    "heapUsed": 123456789
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Configuration

Configuration can be set through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `LOG_LEVEL` | Logging level (ERROR, WARN, INFO, DEBUG) | `INFO` |
| `BROWSER_HEADLESS` | Run browser in headless mode | `true` |
| `DEFAULT_URL` | Default TikTok page for initialization | `https://www.tiktok.com/@rihanna?lang=en` |
| `USER_AGENT` | Browser user agent string | Chrome user agent |
| `CORS_ORIGIN` | CORS allowed origin | `*` |
| `CORS_HEADERS` | CORS allowed headers | `*` |
| `TIMEOUT` | Server timeout in milliseconds | `3600000` |

### Example with Environment Variables

```bash
PORT=3000 LOG_LEVEL=DEBUG npm start
```

## Development

### Project Structure

```
tiktok-signature/
├── src/
│   ├── config.js       # Configuration management
│   ├── signer.js       # Main signature generation logic
│   ├── server.js       # HTTP server implementation
│   ├── validators.js   # Input validation
│   └── logger.js       # Logging utility
├── javascript/         # Browser scripts
│   ├── signer.js
│   ├── webmssdk.js
│   └── xbogus.js
├── examples/          # Usage examples
├── __tests__/         # Test files
├── index.js           # Package entry point
└── listen.js          # Server entry point
```

### Development Mode

```bash
npm run dev
```

## Testing

### Run All Tests

**For unit tests only:**
```bash
npm test -- --testPathIgnorePatterns="integration.test.js|server.test.js"
```

**For all tests (requires server running):**
```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Run all tests
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Test Structure

- `__tests__/utils.test.js` - Utility function tests
- `__tests__/signer.test.js` - Signer class unit tests
- `__tests__/server.test.js` - Server endpoint tests
- `__tests__/integration.test.js` - End-to-end integration tests

## Docker Deployment

### Build Docker Image

```bash
docker build -t tiktok-signature .
```

### Run with Docker

```bash
docker run -p 8080:8080 tiktok-signature
```

### Docker Compose

```bash
docker-compose up -d
```

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  tiktok-signature:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - LOG_LEVEL=INFO
      - BROWSER_HEADLESS=true
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Production Deployment

### Performance Considerations

1. **Memory Management**: The service automatically manages browser contexts to prevent memory leaks
2. **Concurrency**: The server can handle multiple concurrent signature requests
3. **Health Monitoring**: Use `/health` endpoint for load balancer health checks
4. **Logging**: Configure `LOG_LEVEL=WARN` or `LOG_LEVEL=ERROR` in production
5. **Process Management**: Use PM2 or systemd for process management

### PM2 Configuration

```json
{
  "name": "tiktok-signature",
  "script": "./listen.js",
  "instances": 1,
  "exec_mode": "fork",
  "env": {
    "PORT": 8080,
    "LOG_LEVEL": "WARN",
    "NODE_ENV": "production"
  },
  "max_memory_restart": "1G",
  "error_file": "./logs/error.log",
  "out_file": "./logs/out.log",
  "log_date_format": "YYYY-MM-DD HH:mm:ss Z"
}
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Examples

The `/examples` directory contains comprehensive examples for different TikTok API endpoints:

### Available Examples

#### Core Examples
- **`hashtag.js`** - Fetch videos for specific hashtags/challenges
- **`user-info.js`** - Get detailed user profile information
- **`videos.js`** - Fetch user's video feed
- **`trending.js`** - Get trending/discover content
- **`comments.js`** - Fetch video comments and replies
- **`music.js`** - Fetch music/audio videos
- **`simple-test.js`** - Basic signature generation test

#### TypeScript Support
- **`typescript-example.js`** - Compiled TypeScript example
- **`typescript-example.ts`** - TypeScript source with type definitions

### Quick Start with Examples

```bash
# Run basic hashtag example
node examples/hashtag.js [CHALLENGE_ID]

# Run user info example
node examples/user-info.js [USERNAME] --videos --search --relationship

# Run user videos example
node examples/videos.js [SEC_UID]

# Run trending content example
node examples/trending.js

# Run comments example
node examples/comments.js [VIDEO_ID]

# Run music example
node examples/music.js [MUSIC_ID]

# Run simple test
node examples/simple-test.js
```

### Node.js Module Usage

```javascript
import Signer from "tiktok-signature";

const signer = new Signer();
await signer.init();

const signature = await signer.sign("https://m.tiktok.com/api/post/item_list/?aid=1988");
const navigator = await signer.navigator();

console.log(signature);
console.log(navigator);

await signer.close();
```

### API Patterns

The examples demonstrate three main patterns for TikTok API requests:

#### 1. Permanent URL + x-tt-params Only
```javascript
// Used for: hashtags, music videos
const response = await axios({
  method: "GET",
  url: PERMANENT_URL, // Static TikTok URL
  headers: {
    "user-agent": userAgent,
    "x-tt-params": xTtParams, // Encrypted parameters
    "referer": "https://www.tiktok.com/"
  }
});
```

#### 2. Dynamic URL + signed_url
```javascript
// Used for: trending content
const response = await axios({
  method: "GET",
  url: signedUrl, // Generated signed URL
  headers: {
    "user-agent": userAgent,
    "referer": "https://www.tiktok.com/"
  }
});
```

#### 3. Permanent URL Merging + Both Headers
```javascript
// Used for: user info, user videos, comments
const response = await axios({
  method: "GET",
  url: signedUrl, // Merged permanent + custom parameters
  headers: {
    "user-agent": userAgent,
    "x-tt-params": xTtParams,
    "referer": "https://www.tiktok.com/" // Or video-specific referer
  }
});
```

### Python Client Example

```python
import requests

def get_signature(url):
    response = requests.post(
        'http://localhost:8080/signature',
        data=url,
        headers={'Content-Type': 'text/plain'}
    )
    return response.json()

# Example usage
result = get_signature('https://m.tiktok.com/api/post/item_list/?aid=1988&count=30')
print(result['data']['signed_url'])
```

### JavaScript Client Example

```javascript
async function getSignature(url) {
  const response = await fetch('http://localhost:8080/signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: url,
  });

  return await response.json();
}

// Example usage
const result = await getSignature('https://m.tiktok.com/api/post/item_list/?aid=1988');
console.log(result.data.signed_url);
```

## Error Handling

The service provides detailed error messages:

```json
{
  "status": "error",
  "error": {
    "message": "URL must be a TikTok domain",
    "code": 400,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

Common error codes:
- `400` - Bad Request (invalid URL or parameters)
- `404` - Endpoint not found
- `500` - Internal Server Error

## Security Considerations

1. **Input Validation**: All URLs are validated and sanitized
2. **CORS**: Configure CORS appropriately for your use case
3. **Rate Limiting**: Implement rate limiting in production
4. **HTTPS**: Use HTTPS in production environments
5. **Authentication**: Add API key authentication if needed

## Troubleshooting

### Common Issues

1. **Browser fails to launch**
   - Ensure Chromium dependencies are installed
   - Check available system memory

2. **Signature generation fails**
   - Verify the TikTok URL format
   - Check server logs for detailed error messages

3. **High memory usage**
   - Restart the service periodically
   - Configure memory limits in Docker or PM2

## <a href="https://www.buymeacoffee.com/carcabot" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-blue.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow ES module conventions
- Update documentation for API changes
- Ensure all tests pass before submitting PR

## Support

- GitHub Issues: [https://github.com/carcabot/tiktok-signature/issues](https://github.com/carcabot/tiktok-signature/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original author: CarcaBot
- Contributors: See [contributors list](https://github.com/carcabot/tiktok-signature/contributors)

---

**Note**: This service is for educational and research purposes. Ensure compliance with TikTok's Terms of Service when using this tool.