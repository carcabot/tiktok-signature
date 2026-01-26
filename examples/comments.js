/**
 * Comments Example
 *
 * Fetch comments for a specific TikTok video.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run: node examples/comments.js [VIDEO_ID] [COUNT]
 *
 * To get a video ID:
 *   - From URL: https://www.tiktok.com/@user/video/1234567890 -> ID is 1234567890
 */

const SERVER_URL = 'http://localhost:8080';

// Default configuration
const CONFIG = {
  // Example video ID (popular Stranger Things video)
  VIDEO_ID: '7576838857119812895',
  COUNT: 50,
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
 * Build comments API URL
 */
function buildCommentsUrl(videoId, cursor = 0, count = 50) {
  const params = new URLSearchParams({
    WebIdLastTime: Date.now().toString(),
    aid: '1988',
    app_language: 'en',
    app_name: 'tiktok_web',
    aweme_id: videoId,
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
    os: 'linux',
    priority_region: 'US',
    region: 'US',
    screen_height: '1080',
    screen_width: '1920',
    tz_name: 'America/New_York',
    webcast_language: 'en'
  });

  return `https://www.tiktok.com/api/comment/list/?${params.toString()}`;
}

/**
 * Fetch comments
 */
async function fetchComments(videoId, cursor = 0, count = 50) {
  const url = buildCommentsUrl(videoId, cursor, count);

  console.log(`Fetching ${count} comments for video: ${videoId}`);
  console.log(`Cursor: ${cursor}`);
  console.log('');

  // Get signed URL
  const signedData = await getSignedUrl(url);

  // Fetch from TikTok
  const data = await fetchFromTikTok(signedData);

  return data;
}

/**
 * Display comments
 */
function displayResults(data) {
  if (!data.comments || data.comments.length === 0) {
    console.log('No comments found for this video.');
    return;
  }

  console.log(`Found ${data.comments.length} comments!\n`);
  console.log('='.repeat(70));

  data.comments.slice(0, 20).forEach((comment, index) => {
    const author = comment.user?.uniqueId || comment.user?.unique_id || 'Unknown';
    const text = comment.text || '';
    const likes = comment.digg_count || 0;
    const replies = comment.reply_comment_total || 0;
    const createTime = comment.create_time ? new Date(comment.create_time * 1000).toLocaleString() : 'Unknown';

    console.log(`\n${index + 1}. @${author}`);
    console.log(`   "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
    console.log(`   Likes: ${likes.toLocaleString()} | Replies: ${replies}`);
    console.log(`   Posted: ${createTime}`);
  });

  if (data.comments.length > 20) {
    console.log(`\n... and ${data.comments.length - 20} more comments`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Has more comments: ${data.has_more ? 'Yes' : 'No'}`);
  if (data.cursor) {
    console.log(`Next cursor: ${data.cursor}`);
  }
}

// Main execution
async function main() {
  const videoId = process.argv[2] || CONFIG.VIDEO_ID;
  const count = parseInt(process.argv[3]) || CONFIG.COUNT;

  console.log('='.repeat(70));
  console.log('TIKTOK VIDEO COMMENTS');
  console.log('='.repeat(70));
  console.log('');

  try {
    const data = await fetchComments(videoId, 0, count);
    displayResults(data);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
