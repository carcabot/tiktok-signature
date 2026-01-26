# TikTok Signature Examples

These examples demonstrate how to use the TikTok Signature Server to fetch various types of data from TikTok.

## How It Works

1. **Build TikTok API URL** - Construct the URL with all required parameters
2. **Get Signed URL** - Send to `/signature` endpoint to get X-Bogus signature
3. **Make External Request** - Fetch from TikTok using the signed URL with proper headers

This approach is **scalable** - the signature server only generates signatures, while your application handles the actual HTTP requests.

## Prerequisites

1. Start the signature server:

   ```bash
   npm start
   ```

2. Wait for the server to be ready:
   ```bash
   curl http://localhost:8080/health
   # Should return: {"status":"ok","ready":true,...}
   ```

## Available Examples

### basic-signature.js

Simple example showing how to generate a signed URL.

```bash
node examples/basic-signature.js
```

### fetch-videos.js

Fetch videos for a user by secUid.

```bash
node examples/fetch-videos.js [SEC_UID]
```

### user-info.js

Fetch detailed information about a TikTok user by username.

```bash
node examples/user-info.js tiktok
node examples/user-info.js charlidamelio
```

### user-videos.js

Fetch videos for a specific user using their secUid.

```bash
# Default user
node examples/user-videos.js

# Specific user (use secUid from user-info.js)
node examples/user-videos.js "MS4wLjABAAAA..."

# Fetch multiple pages
node examples/user-videos.js "MS4wLjABAAAA..." 30 --multi
```

### hashtag.js

Fetch videos for a specific hashtag/challenge.

```bash
# Use challenge ID (not hashtag name)
node examples/hashtag.js 42164
node examples/hashtag.js 42164 50
```

### trending.js

Fetch trending/discover videos.

```bash
node examples/trending.js
node examples/trending.js 50
```

### comments.js

Fetch comments for a specific video.

```bash
# Use video ID
node examples/comments.js 7449547081733992710
node examples/comments.js 7449547081733992710 100
```

### music.js

Fetch videos that use a specific sound/music.

```bash
# Use music ID
node examples/music.js 7459809498891851526
node examples/music.js 7459809498891851526 50
```

### search.js

Search for videos, users, or hashtags.

```bash
# Search videos (default)
node examples/search.js "dance"

# Search users
node examples/search.js "charlie" user

# Search hashtags
node examples/search.js "fyp" hashtag
```

## Finding IDs

### SecUid (for user-videos.js)

1. Run `user-info.js` with the username
2. The secUid will be displayed in the output

### Video ID (for comments.js)

- From URL: `https://www.tiktok.com/@user/video/1234567890` → ID is `1234567890`
- Or from `user-videos.js` output

### Music ID (for music.js)

- From URL: `https://www.tiktok.com/music/song-name-1234567890` → ID is `1234567890`
- Or from video details in `user-videos.js` output

### Challenge ID (for hashtag.js)

1. Run `search.js "hashtag_name" hashtag`
2. Use the Challenge ID from the output

## Code Pattern

All examples follow this pattern:

```javascript
// 1. Get signed URL from signature server
async function getSignedUrl(url) {
  const response = await fetch("http://localhost:8080/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const result = await response.json();
  return result.data;
}

// 2. Make request to TikTok with signed URL
async function fetchFromTikTok(signedData) {
  const response = await fetch(signedData.signed_url, {
    headers: {
      "User-Agent": signedData.navigator.user_agent,
      Cookie: signedData.cookies,
      Accept: "application/json",
      Referer: "https://www.tiktok.com/",
    },
  });
  return response.json();
}
```

## Alternative: /fetch Endpoint

If external requests fail (due to network restrictions, TLS fingerprinting, etc.), you can use the `/fetch` endpoint as a fallback. This makes requests through the browser but is slower and less scalable:

```javascript
const response = await fetch("http://localhost:8080/fetch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: tiktokUrl }),
});
const result = await response.json();
// result.data contains TikTok response
```

## Tips

- **Use `/signature` endpoint** for scalability (recommended)
- **Use `/fetch` endpoint** only as a fallback when external requests fail
- Restart browser session with `curl http://localhost:8080/restart` if issues occur
- TikTok requires many parameters - the examples include all necessary ones
