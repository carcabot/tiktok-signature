/**
 * User Info Example
 *
 * Fetch information about a TikTok user by username.
 * Uses the search API to find user details.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. Run: node examples/user-info.js [USERNAME]
 */

const SERVER_URL = "http://localhost:8080";

// Default username (TikTok's official account)
const DEFAULT_USERNAME = "tiktok";

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
 * Build user search API URL
 */
function buildUserSearchUrl(username) {
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
    count: "10",
    cursor: "0",
    device_id: "7520531026079925774",
    device_platform: "web_pc",
    focus_state: "true",
    history_len: "2",
    is_fullscreen: "false",
    is_page_visible: "true",
    keyword: username,
    language: "en",
    os: "linux",
    priority_region: "US",
    region: "US",
    screen_height: "1080",
    screen_width: "1920",
    tz_name: "America/New_York",
    webcast_language: "en",
  });

  return `https://www.tiktok.com/api/search/user/full/?${params.toString()}`;
}

/**
 * Fetch user info
 */
async function fetchUserInfo(username) {
  const url = buildUserSearchUrl(username);

  console.log(`Searching for user: @${username}`);
  console.log("");

  // Get signed URL
  console.log("Getting signed URL...");
  const signedData = await getSignedUrl(url);

  // Fetch from TikTok
  console.log("Fetching from TikTok...");
  const data = await fetchFromTikTok(signedData);

  return data || {};
}

/**
 * Display user information
 */
function displayUserInfo(data, targetUsername) {
  const users = data.user_list || data.userList || [];

  if (users.length === 0) {
    console.log("User not found.");
    return null;
  }

  // Find exact match or best match
  const exactMatch = users.find((item) => {
    const user = item.user_info || item;
    return (
      (user.uniqueId || user.unique_id || "").toLowerCase() ===
      targetUsername.toLowerCase()
    );
  });

  const userItem = exactMatch || users[0];
  const user = userItem.user_info || userItem;

  console.log("=".repeat(60));
  console.log("USER PROFILE");
  console.log("=".repeat(60));
  console.log("");

  // Basic info
  console.log(`Username:     @${user.uniqueId || user.unique_id}`);
  console.log(`Nickname:     ${user.nickname}`);
  console.log(`User ID:      ${user.uid || user.id || "N/A"}`);
  console.log(
    `SecUid:       ${(user.secUid || user.sec_uid || "").substring(0, 40)}...`,
  );
  console.log(
    `Verified:     ${user.verified || user.custom_verify ? "Yes" : "No"}`,
  );
  console.log("");

  // Bio
  if (user.signature) {
    console.log(`Bio:          ${user.signature}`);
    console.log("");
  }

  // Stats
  console.log("STATISTICS:");
  console.log(
    `  Followers:    ${(user.followerCount || user.follower_count)?.toLocaleString() || "N/A"}`,
  );
  console.log(
    `  Following:    ${(user.followingCount || user.following_count)?.toLocaleString() || "N/A"}`,
  );
  console.log(
    `  Total Likes:  ${(user.heartCount || user.total_favorited)?.toLocaleString() || "N/A"}`,
  );
  console.log("");

  console.log("=".repeat(60));

  // Output secUid for use with other examples
  const secUid = user.secUid || user.sec_uid;
  if (secUid) {
    console.log("\nUse this secUid with fetch-videos.js:");
    console.log(`node examples/fetch-videos.js "${secUid}"`);
  }

  // Show other matches if not exact
  if (!exactMatch && users.length > 1) {
    console.log("\n--- Other matching users ---");
    users.slice(1, 5).forEach((item, index) => {
      const u = item.user_info || item;
      console.log(
        `${index + 2}. @${u.uniqueId || u.unique_id} - ${u.nickname}`,
      );
    });
  }

  return user;
}

// Main execution
async function main() {
  const username = process.argv[2] || DEFAULT_USERNAME;

  try {
    const data = await fetchUserInfo(username);
    displayUserInfo(data, username);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
