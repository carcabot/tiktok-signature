/**
 * Trending Videos Example
 *
 * Fetch trending/discover videos from TikTok.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run: node examples/trending.js [COUNT]
 */

const SERVER_URL = 'http://localhost:8080';

// Default configuration
const CONFIG = {
  COUNT: 30,
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
 * Build trending/recommend API URL
 */
function buildTrendingUrl(count = 30) {
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
    device_id: CONFIG.DEVICE_ID,
    device_platform: 'web_pc',
    focus_state: 'true',
    from_page: 'fyp',
    history_len: '2',
    is_fullscreen: 'false',
    is_page_visible: 'true',
    language: 'en',
    os: 'linux',
    priority_region: 'US',
    region: 'US',
    screen_height: '1080',
    screen_width: '1920',
    tz_name: 'America/New_York',
    webcast_language: 'en'
  });

  return `https://www.tiktok.com/api/recommend/item_list/?${params.toString()}`;
}

/**
 * Fetch trending videos
 */
async function fetchTrendingVideos(count = 30) {
  const url = buildTrendingUrl(count);

  console.log(`Fetching ${count} trending videos...`);
  console.log('');

  // Get signed URL
  const signedData = await getSignedUrl(url);

  // Fetch from TikTok
  const data = await fetchFromTikTok(signedData);

  return data;
}

/**
 * Display trending video results
 */
function displayResults(data) {
  if (!data.itemList || data.itemList.length === 0) {
    console.log('No trending videos found.');
    return;
  }

  console.log(`Found ${data.itemList.length} trending videos!\n`);
  console.log('='.repeat(70));

  data.itemList.forEach((video, index) => {
    console.log(`\n${index + 1}. Video ID: ${video.id}`);
    console.log(`   Author: @${video.author?.uniqueId || 'Unknown'} ${video.author?.verified ? '(Verified)' : ''}`);
    console.log(`   Description: ${(video.desc || 'No description').substring(0, 55)}${video.desc?.length > 55 ? '...' : ''}`);

    if (video.stats) {
      const views = video.stats.playCount;
      const likes = video.stats.diggCount;
      const viewsFormatted = views >= 1000000 ? `${(views/1000000).toFixed(1)}M` :
                             views >= 1000 ? `${(views/1000).toFixed(1)}K` : views;
      const likesFormatted = likes >= 1000000 ? `${(likes/1000000).toFixed(1)}M` :
                             likes >= 1000 ? `${(likes/1000).toFixed(1)}K` : likes;

      console.log(`   Views: ${viewsFormatted} | Likes: ${likesFormatted} | Comments: ${video.stats.commentCount?.toLocaleString() || 'N/A'}`);
    }

    if (video.music?.title) {
      console.log(`   Music: ${video.music.title.substring(0, 40)}${video.music.title.length > 40 ? '...' : ''}`);
    }

    // Show hashtags
    if (video.textExtra && video.textExtra.length > 0) {
      const hashtags = video.textExtra
        .filter(tag => tag.hashtagName)
        .map(tag => `#${tag.hashtagName}`)
        .slice(0, 4)
        .join(' ');
      if (hashtags) {
        console.log(`   Tags: ${hashtags}`);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${data.itemList.length} videos`);
  console.log(`Has more: ${data.hasMore ? 'Yes' : 'No'}`);
}

// Main execution
async function main() {
  const count = parseInt(process.argv[2]) || CONFIG.COUNT;

  console.log('='.repeat(70));
  console.log('TIKTOK TRENDING VIDEOS');
  console.log('='.repeat(70));
  console.log('');

  try {
    const data = await fetchTrendingVideos(count);
    displayResults(data);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
