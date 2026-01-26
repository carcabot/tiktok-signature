/**
 * Fetch Videos Example
 *
 * Demonstrates how to fetch TikTok videos using the signature server.
 * Uses /signature with external request, falls back to /fetch if needed.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run this example: node examples/fetch-videos.js [SEC_UID]
 */

const SERVER_URL = 'http://localhost:8080';

// Default secUid (TikTok's official account)
const DEFAULT_SEC_UID = 'MS4wLjABAAAAv7iSuuXDJGDvJkmH_vz1qkDZYo1apxgzaxdBSeIuPiM';

/**
 * Get signed URL from signature server
 */
async function getSignedUrl(url) {
  const response = await fetch(`${SERVER_URL}/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const result = await response.json();
  if (result.status !== 'ok') {
    throw new Error(result.message || 'Signature generation failed');
  }

  return result.data;
}

/**
 * Make request to TikTok API with signed URL
 */
async function fetchFromTikTok(signedData) {
  const response = await fetch(signedData.signed_url, {
    headers: {
      'User-Agent': signedData.navigator.user_agent,
      'Cookie': signedData.cookies,
      'Accept': 'application/json',
      'Referer': 'https://www.tiktok.com/'
    }
  });

  const text = await response.text();
  if (!text || text.length === 0) {
    return null; // Empty response, need fallback
  }

  return JSON.parse(text);
}

/**
 * Fallback: Fetch through browser using /fetch endpoint
 */
async function fetchViaBrowser(url) {
  console.log('Using /fetch fallback (browser-based request)...');

  const response = await fetch(`${SERVER_URL}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const result = await response.json();
  if (result.status !== 'ok') {
    throw new Error(result.message || 'Fetch failed');
  }

  return result.data;
}

async function fetchVideos(secUid) {
  // Build the TikTok API URL with all required parameters
  const params = new URLSearchParams({
    WebIdLastTime: Date.now().toString(),
    aid: '1988',
    app_language: 'en',
    app_name: 'tiktok_web',
    browser_language: 'en-US',
    browser_name: 'Mozilla',
    browser_online: 'true',
    browser_platform: 'Linux x86_64',
    browser_version: '5.0',
    channel: 'tiktok_web',
    cookie_enabled: 'true',
    count: '30',
    cursor: '0',
    device_id: '7520531026079925774',
    device_platform: 'web_pc',
    focus_state: 'true',
    history_len: '2',
    is_fullscreen: 'false',
    is_page_visible: 'true',
    language: 'en',
    os: 'linux',
    priority_region: 'US',
    region: 'US',
    screen_height: '1080',
    screen_width: '1920',
    secUid: secUid,
    tz_name: 'America/New_York',
    webcast_language: 'en'
  });

  const tiktokUrl = `https://www.tiktok.com/api/post/item_list/?${params.toString()}`;

  console.log('Fetching videos for secUid:', secUid.substring(0, 30) + '...');
  console.log('');

  let data;

  // Try external request first
  try {
    console.log('Step 1: Getting signed URL from signature server...');
    const signedData = await getSignedUrl(tiktokUrl);
    console.log(`X-Bogus: ${signedData['x-bogus']}`);
    console.log('');

    console.log('Step 2: Making external request to TikTok API...');
    data = await fetchFromTikTok(signedData);
  } catch (e) {
    console.log('External request failed:', e.message);
    data = null;
  }

  // Fallback to /fetch if external request returned empty
  if (!data || !data.itemList) {
    console.log('External request returned empty, using fallback...');
    data = await fetchViaBrowser(tiktokUrl);
  }

  if (data && data.itemList && data.itemList.length > 0) {
    console.log(`Found ${data.itemList.length} videos!\n`);

    data.itemList.slice(0, 5).forEach((video, index) => {
      console.log(`${index + 1}. Video ID: ${video.id}`);
      console.log(`   Description: ${(video.desc || 'No description').substring(0, 50)}...`);
      console.log(`   Views: ${video.stats?.playCount?.toLocaleString() || 'N/A'}`);
      console.log(`   Likes: ${video.stats?.diggCount?.toLocaleString() || 'N/A'}`);
      console.log(`   Comments: ${video.stats?.commentCount?.toLocaleString() || 'N/A'}`);
      console.log('');
    });

    console.log(`Has more videos: ${data.hasMore ? 'Yes' : 'No'}`);
    if (data.cursor) {
      console.log(`Next cursor: ${data.cursor}`);
    }
  } else {
    console.log('No videos found');
  }

  return data;
}

// Run the example
const secUid = process.argv[2] || DEFAULT_SEC_UID;

fetchVideos(secUid)
  .then(() => {
    console.log('\nExample completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nError:', error.message);
    process.exit(1);
  });
