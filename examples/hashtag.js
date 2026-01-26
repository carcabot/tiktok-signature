/**
 * Hashtag/Challenge Example
 *
 * Fetch videos for a specific hashtag/challenge.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run: node examples/hashtag.js [CHALLENGE_ID] [COUNT]
 *
 * Note: You need the challenge ID, not just the hashtag name.
 * Use search.js with "hashtag" type to find challenge IDs.
 */

const SERVER_URL = "http://localhost:8080";

// Default configuration
const CONFIG = {
  // Example: #fyp challenge ID
  CHALLENGE_ID: "42164",
  CHALLENGE_NAME: "fyp",
  COUNT: 30,
  DEVICE_ID: "7520531026079925774",
};

/**
 * Get signed URL from signature server
 */
async function getSignedUrl(url) {
  const response = await fetch(`${SERVER_URL}/signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const result = await response.json();
  if (result.status !== "ok") {
    throw new Error(result.message || "Signature generation failed");
  }

  return result.data;
}

/**
 * Make request to TikTok API with signed URL
 */
async function fetchFromTikTok(signedData) {
  const response = await fetch(signedData.signed_url, {
    headers: {
      "User-Agent": signedData.navigator.user_agent,
      Cookie: signedData.cookies,
      Accept: "application/json",
      Referer: "https://www.tiktok.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`TikTok API returned ${response.status}`);
  }

  return response.json();
}

/**
 * Build hashtag/challenge API URL
 */
function buildChallengeUrl(challengeId, cursor = 0, count = 30) {
  const params = new URLSearchParams({
    WebIdLastTime: Date.now().toString(),
    aid: "1988",
    app_language: "en",
    app_name: "tiktok_web",
    browser_language: "en-US",
    browser_name: "Mozilla",
    browser_online: "true",
    browser_platform: "Linux x86_64",
    browser_version: "5.0",
    challengeID: challengeId,
    channel: "tiktok_web",
    cookie_enabled: "true",
    count: count.toString(),
    cursor: cursor.toString(),
    device_id: CONFIG.DEVICE_ID,
    device_platform: "web_pc",
    focus_state: "true",
    history_len: "2",
    is_fullscreen: "false",
    is_page_visible: "true",
    language: "en",
    os: "linux",
    priority_region: "US",
    region: "US",
    screen_height: "1080",
    screen_width: "1920",
    tz_name: "America/New_York",
    webcast_language: "en",
  });

  return `https://www.tiktok.com/api/challenge/item_list/?${params.toString()}`;
}

/**
 * Fetch hashtag videos
 */
async function fetchHashtagVideos(challengeId, cursor = 0, count = 30) {
  const url = buildChallengeUrl(challengeId, cursor, count);

  console.log(`Fetching ${count} videos for challenge ID: ${challengeId}`);
  console.log(`Cursor: ${cursor}`);
  console.log("");

  // Get signed URL
  const signedData = await getSignedUrl(url);

  // Fetch from TikTok
  const data = await fetchFromTikTok(signedData);

  return data;
}

/**
 * Display hashtag video results
 */
function displayResults(data, challengeName) {
  if (!data.itemList || data.itemList.length === 0) {
    console.log("No videos found for this hashtag.");
    console.log(
      "Note: Make sure you're using a valid challenge ID, not hashtag name.",
    );
    return;
  }

  console.log(`Found ${data.itemList.length} videos for #${challengeName}!\n`);
  console.log("=".repeat(60));

  data.itemList.slice(0, 10).forEach((video, index) => {
    console.log(`\n${index + 1}. Video ID: ${video.id}`);
    console.log(`   Author: @${video.author?.uniqueId || "Unknown"}`);
    console.log(
      `   Description: ${(video.desc || "No description").substring(0, 50)}...`,
    );

    if (video.stats) {
      console.log(
        `   Views: ${video.stats.playCount?.toLocaleString() || "N/A"}`,
      );
      console.log(
        `   Likes: ${video.stats.diggCount?.toLocaleString() || "N/A"}`,
      );
    }
  });

  if (data.itemList.length > 10) {
    console.log(`\n... and ${data.itemList.length - 10} more videos`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Has more videos: ${data.hasMore ? "Yes" : "No"}`);
  if (data.cursor) {
    console.log(`Next cursor: ${data.cursor}`);
  }
}

// Main execution
async function main() {
  const challengeId = process.argv[2] || CONFIG.CHALLENGE_ID;
  const count = parseInt(process.argv[3]) || CONFIG.COUNT;

  console.log("=".repeat(60));
  console.log("HASHTAG/CHALLENGE VIDEO FETCHER");
  console.log("=".repeat(60));
  console.log("");

  try {
    const data = await fetchHashtagVideos(challengeId, 0, count);
    displayResults(data, CONFIG.CHALLENGE_NAME);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
