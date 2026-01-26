/**
 * Search Example
 *
 * Search for videos, users, or hashtags on TikTok.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run: node examples/search.js [KEYWORD] [TYPE]
 *
 * Types:
 *   - video (default) - Search for videos
 *   - user - Search for users
 *   - hashtag - Search for hashtags
 */

const SERVER_URL = 'http://localhost:8080';

// Default configuration
const CONFIG = {
  KEYWORD: 'dance',
  TYPE: 'video',
  COUNT: 20,
  DEVICE_ID: '7520531026079925774'
};

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

  if (!response.ok) {
    throw new Error(`TikTok API returned ${response.status}`);
  }

  return response.json();
}

/**
 * Build search API URL
 */
function buildSearchUrl(keyword, type = 'video', cursor = 0, count = 20) {
  // Map type to TikTok's search_id format
  const searchType = {
    'video': '1',
    'user': '2',
    'hashtag': '3'
  }[type] || '1';

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
    count: count.toString(),
    cursor: cursor.toString(),
    device_id: CONFIG.DEVICE_ID,
    device_platform: 'web_pc',
    focus_state: 'true',
    history_len: '2',
    is_fullscreen: 'false',
    is_page_visible: 'true',
    keyword: keyword,
    language: 'en',
    offset: cursor.toString(),
    os: 'linux',
    priority_region: 'US',
    region: 'US',
    screen_height: '1080',
    screen_width: '1920',
    search_id: searchType,
    tz_name: 'America/New_York',
    webcast_language: 'en'
  });

  // Different endpoints for different search types
  const endpoints = {
    'video': 'https://www.tiktok.com/api/search/general/full/',
    'user': 'https://www.tiktok.com/api/search/user/full/',
    'hashtag': 'https://www.tiktok.com/api/search/challenge/full/'
  };

  return `${endpoints[type] || endpoints.video}?${params.toString()}`;
}

/**
 * Fetch search results
 */
async function fetchSearchResults(keyword, type = 'video', cursor = 0, count = 20) {
  const url = buildSearchUrl(keyword, type, cursor, count);

  console.log(`Searching for "${keyword}" (type: ${type})`);
  console.log(`Count: ${count}`);
  console.log('');

  // Get signed URL
  const signedData = await getSignedUrl(url);

  // Fetch from TikTok
  const data = await fetchFromTikTok(signedData);

  return data;
}

/**
 * Display video search results
 */
function displayVideoResults(data) {
  const items = data.data || data.itemList || [];

  if (items.length === 0) {
    console.log('No videos found for this search.');
    return;
  }

  console.log(`Found ${items.length} videos!\n`);
  console.log('='.repeat(70));

  items.slice(0, 15).forEach((item, index) => {
    const video = item.item || item;
    console.log(`\n${index + 1}. Video ID: ${video.id}`);
    console.log(`   Author: @${video.author?.uniqueId || 'Unknown'}`);
    console.log(`   Description: ${(video.desc || 'No description').substring(0, 50)}...`);

    if (video.stats) {
      console.log(`   Views: ${video.stats.playCount?.toLocaleString() || 'N/A'} | Likes: ${video.stats.diggCount?.toLocaleString() || 'N/A'}`);
    }
  });

  console.log('\n' + '='.repeat(70));
}

/**
 * Display user search results
 */
function displayUserResults(data) {
  const users = data.user_list || data.userList || [];

  if (users.length === 0) {
    console.log('No users found for this search.');
    return;
  }

  console.log(`Found ${users.length} users!\n`);
  console.log('='.repeat(70));

  users.forEach((item, index) => {
    const user = item.user_info || item;
    console.log(`\n${index + 1}. @${user.uniqueId || user.unique_id}`);
    console.log(`   Nickname: ${user.nickname}`);
    console.log(`   Verified: ${user.verified ? 'Yes' : 'No'}`);
    console.log(`   Followers: ${user.followerCount?.toLocaleString() || 'N/A'}`);
    if (user.signature) {
      console.log(`   Bio: ${user.signature.substring(0, 50)}${user.signature.length > 50 ? '...' : ''}`);
    }
  });

  console.log('\n' + '='.repeat(70));
}

/**
 * Display hashtag search results
 */
function displayHashtagResults(data) {
  const challenges = data.challenge_list || data.challengeList || [];

  if (challenges.length === 0) {
    console.log('No hashtags found for this search.');
    return;
  }

  console.log(`Found ${challenges.length} hashtags!\n`);
  console.log('='.repeat(70));

  challenges.forEach((item, index) => {
    const challenge = item.challenge_info || item;
    console.log(`\n${index + 1}. #${challenge.cha_name || challenge.title}`);
    console.log(`   Challenge ID: ${challenge.cid || challenge.id}`);
    console.log(`   Views: ${challenge.view_count?.toLocaleString() || challenge.stats?.videoCount?.toLocaleString() || 'N/A'}`);
    if (challenge.desc) {
      console.log(`   Description: ${challenge.desc.substring(0, 50)}...`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\nUse the Challenge ID with hashtag.js example:');
  console.log('node examples/hashtag.js [CHALLENGE_ID]');
}

// Main execution
async function main() {
  const keyword = process.argv[2] || CONFIG.KEYWORD;
  const type = process.argv[3] || CONFIG.TYPE;

  console.log('='.repeat(70));
  console.log(`TIKTOK SEARCH: "${keyword}" (${type})`);
  console.log('='.repeat(70));
  console.log('');

  try {
    const data = await fetchSearchResults(keyword, type, 0, CONFIG.COUNT);

    switch (type) {
      case 'user':
        displayUserResults(data);
        break;
      case 'hashtag':
        displayHashtagResults(data);
        break;
      default:
        displayVideoResults(data);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
