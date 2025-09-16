# TikTok Signature Examples

This directory contains production-ready examples demonstrating different TikTok API endpoints and signature generation patterns.

## Quick Start

```bash
# Start the signature server first (optional for direct usage)
npm start

# Run any example directly
node examples/hashtag.js [CHALLENGE_ID]
node examples/user-info.js [USERNAME] --videos
node examples/trending.js
```

## Available Examples

### Core Examples
- **`hashtag.js`** - Fetch videos for specific hashtags/challenges
- **`user-info.js`** - Get detailed user profile information
- **`videos.js`** - Fetch user's video feed
- **`music.js`** - Get user's music/audio videos
- **`trending.js`** - Get trending/discover content
- **`comments.js`** - Fetch video comments and replies
- **`simple-test.js`** - Basic signature generation test

### TypeScript Support
- **`typescript-example.js`** - Compiled TypeScript example
- **`typescript-example.ts`** - TypeScript source with type definitions

## Usage Examples

### Hashtag Videos
```bash
# Use default challenge ID
node examples/hashtag.js

# Use specific challenge ID
node examples/hashtag.js 1659902394498053
```

### User Information
```bash
# Basic user info
node examples/user-info.js tiktok

# User info with videos
node examples/user-info.js tiktok --videos

# Search for user and include relationship info
node examples/user-info.js tiktok --search --relationship
```

### User Videos
```bash
# Use default SEC_UID
node examples/videos.js

# Use specific SEC_UID
node examples/videos.js MS4wLjABAAAAv7iSuuXDJGDvJkmH_vz1qkDZYo1apxgzaxdBSeIuPiM
```

### Comments
```bash
# Use default video ID
node examples/comments.js

# Use specific video ID
node examples/comments.js 7195062981313580293
```

### Music Videos
```bash
# Use default music ID
node examples/music.js

# Use specific music ID
node examples/music.js 6972436815763683077
```

### Trending Content
```bash
node examples/trending.js
```

### Simple Test
```bash
node examples/simple-test.js
```

### TypeScript Example
```bash
# Run compiled TypeScript
node examples/typescript-example.js

# Compile and run TypeScript (requires ts-node)
npx ts-node examples/typescript-example.ts
```

## API Patterns

The examples demonstrate three main patterns for TikTok API requests:

### 1. Permanent URL + x-tt-params Only
Used for: hashtags, music videos
```javascript
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

### 2. Dynamic URL + signed_url
Used for: trending content
```javascript
const response = await axios({
  method: "GET",
  url: signedUrl, // Generated signed URL
  headers: {
    "user-agent": userAgent,
    "referer": "https://www.tiktok.com/"
  }
});
```

### 3. Permanent URL Merging + Both Headers
Used for: user info, user videos, comments
```javascript
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

## Direct Module Usage

All examples use the Signer class directly:

```javascript
import Signer from "../index.js";

const signer = new Signer();
await signer.init();

const signature = await signer.sign("https://m.tiktok.com/api/post/item_list/?aid=1988");
const navigator = await signer.navigator();

console.log(signature);
await signer.close();
```

## Features

- **Production-Ready**: Comprehensive error handling and logging
- **Class-Based Architecture**: Clean, maintainable code structure
- **Enhanced Signature Generation**: X-Bogus and X-Gnarly support
- **TypeScript Support**: Full type definitions and examples
- **Flexible Configuration**: Customizable parameters and options
- **Robust Error Handling**: Detailed error messages and recovery
- **Performance Optimized**: Efficient browser context management

## Error Handling

All examples include comprehensive error handling:

```javascript
try {
  const data = await api.fetchHashtagVideos();
  api.displayResults(data);
} catch (error) {
  console.error("❌ Error:", error.message);

  if (error.response?.status === 404) {
    console.error("🏷️ Resource not found");
  } else if (error.response?.status === 403) {
    console.error("🚫 Access forbidden");
  }
}
```

## Configuration

Examples use consistent configuration patterns:

```javascript
const CONFIG = {
  CHALLENGE_ID: "1659902394498053",
  USER_AGENT: "Mozilla/5.0...",
  PERMANENT_URL: "https://www.tiktok.com/api/...",
  PARAMS: {
    aid: "1988",
    count: 30,
    cursor: 0
  }
};
```

## Best Practices

1. **Always initialize the signer**: `await signer.init()`
2. **Clean up resources**: `await signer.close()`
3. **Handle errors gracefully**: Use try/catch blocks
4. **Use appropriate headers**: Include user-agent and referer
5. **Respect rate limits**: Add delays between requests
6. **Validate responses**: Check for expected data structure

## Troubleshooting

### Common Issues

1. **Signer initialization fails**
   - Ensure Chromium dependencies are installed
   - Check available system memory

2. **API returns empty results**
   - Verify IDs exist (challenge ID, SEC_UID, video ID, music ID)
   - Check for typos in parameters

3. **Rate limiting errors**
   - Add delays between requests
   - Use smaller batch sizes

4. **Signature generation fails**
   - Check console output for detailed errors
   - Ensure browser can launch properly

## Support

- Main Documentation: [../README.md](../README.md)
- GitHub Issues: [Report bugs and request features](https://github.com/carcabot/tiktok-signature/issues)