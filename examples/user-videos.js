/**
 * User Videos Example
 *
 * Fetch videos for a specific TikTok user using their secUid.
 * Uses /signature with external request, falls back to /fetch if needed.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run: node examples/user-videos.js [SEC_UID] [COUNT]
 *
 * To get a user's secUid, use user-info.js example.
 */

const SERVER_URL = "http://localhost:8080";

// Default configuration
const CONFIG = {
  SEC_UID:
    "MS4wLjABAAAAtBazTpLuo5XSFwEiX3gkaeV4ZY7u071I08MUNFL5B_zZoelUkTWrhCVvxK7LqAkr",
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
  console.log("Using /fetch fallback (browser-based request)...");

  const response = await fetch(`${SERVER_URL}/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const result = await response.json();
  if (result.status !== "ok") {
    throw new Error(result.message || "Fetch failed");
  }

  return result.data;
}

/**
 * Build TikTok API URL with all required parameters
 */
function buildApiUrl(secUid, cursor = 0, count = 30) {
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
    channel: "tiktok_web",
    cookie_enabled: "true",
    count: count.toString(),
    coverFormat: "0",
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
    secUid: secUid,
    tz_name: "America/New_York",
    webcast_language: "en",
  });

  return `https://www.tiktok.com/api/post/item_list/?${params.toString()}`;
}

/**
 * Fetch user videos with automatic fallback
 */
async function fetchUserVideos(secUid, cursor = 0, count = 30) {
  const url = buildApiUrl(secUid, cursor, count);

  console.log(`Fetching ${count} videos for user...`);
  console.log(`SecUid: ${secUid.substring(0, 30)}...`);
  console.log(`Cursor: ${cursor}`);
  console.log("");

  let data;

  // Try external request first
  try {
    const signedData = await getSignedUrl(url);
    data = await fetchFromTikTok(signedData);
  } catch (e) {
    console.log("External request failed:", e.message);
    data = null;
  }

  // Fallback to /fetch if external request returned empty
  if (!data || !data.itemList) {
    data = await fetchViaBrowser(url);
  }

  return data;
}

/**
 * Display video results
 */
function displayResults(data) {
  if (!data || !data.itemList || data.itemList.length === 0) {
    console.log("No videos found for this user.");
    return;
  }

  console.log(`Found ${data.itemList.length} videos!\n`);
  console.log("=".repeat(60));

  data.itemList.forEach((video, index) => {
    console.log(`\n${index + 1}. Video ID: ${video.id}`);
    console.log(
      `   Description: ${(video.desc || "No description").substring(0, 60)}${video.desc?.length > 60 ? "..." : ""}`,
    );
    console.log(
      `   Created: ${new Date(video.createTime * 1000).toLocaleDateString()}`,
    );

    if (video.stats) {
      console.log(
        `   Views: ${video.stats.playCount?.toLocaleString() || "N/A"}`,
      );
      console.log(
        `   Likes: ${video.stats.diggCount?.toLocaleString() || "N/A"}`,
      );
      console.log(
        `   Comments: ${video.stats.commentCount?.toLocaleString() || "N/A"}`,
      );
      console.log(
        `   Shares: ${video.stats.shareCount?.toLocaleString() || "N/A"}`,
      );
    }

    if (video.video?.duration) {
      console.log(`   Duration: ${video.video.duration}s`);
    }

    if (video.music?.title) {
      console.log(
        `   Music: ${video.music.title} - ${video.music.authorName || "Unknown"}`,
      );
    }
  });

  console.log("\n" + "=".repeat(60));
  console.log(`Has more videos: ${data.hasMore ? "Yes" : "No"}`);
  if (data.cursor) {
    console.log(`Next cursor: ${data.cursor}`);
  }
}

/**
 * Fetch multiple pages of videos
 */
async function fetchMultiplePages(secUid, maxPages = 3, videosPerPage = 30) {
  console.log(
    `Fetching up to ${maxPages} pages with ${videosPerPage} videos each...\n`,
  );

  let cursor = 0;
  let allVideos = [];
  let hasMore = true;

  for (let page = 1; page <= maxPages && hasMore; page++) {
    console.log(`--- Page ${page} ---`);

    const data = await fetchUserVideos(secUid, cursor, videosPerPage);

    if (data && data.itemList && data.itemList.length > 0) {
      allVideos.push(...data.itemList);
      console.log(
        `Fetched ${data.itemList.length} videos (total: ${allVideos.length})\n`,
      );

      hasMore = data.hasMore;
      cursor = data.cursor || 0;
    } else {
      hasMore = false;
    }

    // Small delay between requests
    if (hasMore && page < maxPages) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { itemList: allVideos, hasMore };
}

// Main execution
async function main() {
  const secUid = process.argv[2] || CONFIG.SEC_UID;
  const count = parseInt(process.argv[3]) || CONFIG.COUNT;
  const multiPage = process.argv.includes("--multi");

  try {
    let data;
    if (multiPage) {
      data = await fetchMultiplePages(secUid, 3, count);
    } else {
      data = await fetchUserVideos(secUid, 0, count);
    }

    displayResults(data);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
