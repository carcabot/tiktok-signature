/**
 * Music/Sound Videos Example
 *
 * Fetch videos that use a specific sound/music.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run: node examples/music.js [MUSIC_ID] [COUNT]
 *
 * To get a music ID:
 *   - From URL: https://www.tiktok.com/music/song-name-1234567890 -> ID is 1234567890
 *   - Or check video details from user-videos.js example
 */

const SERVER_URL = 'http://localhost:8080';

// Default configuration
const CONFIG = {
  // Example music ID (popular sound)
  MUSIC_ID: '7540087409585948689',
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
 * Build music videos API URL
 */
function buildMusicUrl(musicId, cursor = 0, count = 30) {
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
    language: 'en',
    musicID: musicId,
    os: 'linux',
    priority_region: 'US',
    region: 'US',
    screen_height: '1080',
    screen_width: '1920',
    tz_name: 'America/New_York',
    webcast_language: 'en'
  });

  return `https://www.tiktok.com/api/music/item_list/?${params.toString()}`;
}

/**
 * Fetch music videos
 */
async function fetchMusicVideos(musicId, cursor = 0, count = 30) {
  const url = buildMusicUrl(musicId, cursor, count);

  console.log(`Fetching ${count} videos for music ID: ${musicId}`);
  console.log(`Cursor: ${cursor}`);
  console.log('');

  // Get signed URL
  const signedData = await getSignedUrl(url);

  // Fetch from TikTok
  const data = await fetchFromTikTok(signedData);

  return data;
}

/**
 * Display music video results
 */
function displayResults(data) {
  // Display music info if available
  if (data.musicInfo) {
    const music = data.musicInfo;
    console.log('='.repeat(70));
    console.log('MUSIC INFO');
    console.log('='.repeat(70));
    console.log(`Title:    ${music.title || 'Unknown'}`);
    console.log(`Author:   ${music.authorName || 'Unknown'}`);
    console.log(`Album:    ${music.album || 'N/A'}`);
    console.log(`Duration: ${music.duration || 'N/A'}s`);
    if (music.playUrl) {
      console.log(`Play URL: ${music.playUrl.substring(0, 60)}...`);
    }
    console.log('');
  }

  if (!data.itemList || data.itemList.length === 0) {
    console.log('No videos found for this music.');
    console.log('Note: Make sure the music ID is valid.');
    return;
  }

  console.log('='.repeat(70));
  console.log(`VIDEOS USING THIS SOUND (${data.itemList.length} found)`);
  console.log('='.repeat(70));

  data.itemList.slice(0, 15).forEach((video, index) => {
    console.log(`\n${index + 1}. Video ID: ${video.id}`);
    console.log(`   Author: @${video.author?.uniqueId || 'Unknown'} ${video.author?.verified ? '(Verified)' : ''}`);
    console.log(`   Description: ${(video.desc || 'No description').substring(0, 50)}${video.desc?.length > 50 ? '...' : ''}`);

    if (video.stats) {
      const views = video.stats.playCount;
      const viewsFormatted = views >= 1000000 ? `${(views/1000000).toFixed(1)}M` :
                             views >= 1000 ? `${(views/1000).toFixed(1)}K` : views;
      console.log(`   Views: ${viewsFormatted} | Likes: ${video.stats.diggCount?.toLocaleString() || 'N/A'}`);
    }
  });

  if (data.itemList.length > 15) {
    console.log(`\n... and ${data.itemList.length - 15} more videos`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Has more videos: ${data.hasMore ? 'Yes' : 'No'}`);
  if (data.cursor) {
    console.log(`Next cursor: ${data.cursor}`);
  }
}

// Main execution
async function main() {
  const musicId = process.argv[2] || CONFIG.MUSIC_ID;
  const count = parseInt(process.argv[3]) || CONFIG.COUNT;

  console.log('='.repeat(70));
  console.log('TIKTOK MUSIC/SOUND VIDEOS');
  console.log('='.repeat(70));
  console.log('');

  try {
    const data = await fetchMusicVideos(musicId, 0, count);
    displayResults(data);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
