import Signer from "../index.js";
import axios from "axios";

/**
 * TikTok Hashtag Videos API Example
 * Pattern: Permanent URL + x-tt-params header only
 *
 * This example demonstrates how to fetch videos for a specific hashtag/challenge.
 * Uses the permanent URL approach where x-tt-params contains the signed parameters.
 */

// Configuration
const CONFIG = {
  CHALLENGE_ID: "1659902394498053", // Change this to your target hashtag ID
  USER_AGENT: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",

  // Permanent URL - always use this exact URL for the final API request
  PERMANENT_URL: "https://www.tiktok.com/api/challenge/item_list/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=0.54&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F109.0.0.0%20Safari%2F537.36&challengeID=13187&channel=tiktok_web&cookie_enabled=true&count=30&cursor=30&device_id=7195820289077478917&device_platform=web_pc&focus_state=true&from_page=hashtag&history_len=5&is_fullscreen=false&is_page_visible=true&language=en&os=mac&priority_region=&referer=&region=RO&root_referer=https%3A%2F%2Fwww.tiktok.com%2F404%3FfromUrl%3D%2Fhashtag&screen_height=1120&screen_width=1792&tz_name=Europe%2FBucharest&verifyFp=verify_ldo6d7go_rfalj7WR_Cqtf_4z9G_Aj1J_WSrSUzWZSJ6U&webcast_language=en&msToken=8G5wMuMotboG4hiWsuvDxdQ-VbOZh29r-tMYpFzA56ODNmsk1_RL6xYfiJJvzznY8jK4h4m9CHR2QHJLayqE7lzKFm97L5pmXen7VCGVVIt9s6vU2nNnlmiZW-HTn10YT83WW__OMEaK42s=&X-Bogus=DFSzswVOe5bANjvTS4iHxr7TlqCW&_signature=_02B4Z6wo0000146bL2gAAIDAGk10ZlbQ1n-OmyvAAICC3d",

  // Request parameters for signing
  PARAMS: {
    aid: "1988",
    count: 30,
    cursor: 0,
    cookie_enabled: true,
    screen_width: 1920,
    screen_height: 1080,
    browser_language: "en-US",
    browser_platform: "MacIntel",
    browser_name: "Mozilla",
    browser_version: "5.0",
    browser_online: true,
    timezone_name: "Europe/London"
  }
};

class HashtagVideosAPI {
  constructor(challengeId = CONFIG.CHALLENGE_ID) {
    this.challengeId = challengeId;
    this.signer = null;
  }

  async initialize() {
    console.log("🚀 Initializing TikTok Hashtag Videos API");
    console.log("🏷️ Challenge ID:", this.challengeId);
    console.log("🌐 User Agent:", CONFIG.USER_AGENT.substring(0, 50) + "...");

    this.signer = new Signer(null, CONFIG.USER_AGENT);

    console.log("⏳ Starting browser and loading TikTok scripts...");
    await this.signer.init();
    console.log("✅ Signer initialized successfully");
  }

  async getSignature() {
    const params = {
      ...CONFIG.PARAMS,
      challengeID: this.challengeId
    };

    const queryString = new URLSearchParams(params).toString();
    const unsignedUrl = `https://www.tiktok.com/api/challenge/item_list/?${queryString}`;

    console.log("📝 Query parameters:", Object.keys(params).length, "parameters");
    console.log("🔗 Unsigned URL:", unsignedUrl.substring(0, 80) + "...");

    console.log("✍️ Generating signature...");
    const signature = await this.signer.sign(unsignedUrl);

    const navigator = await this.signer.navigator();

    return {
      xTtParams: signature["x-tt-params"],
      userAgent: navigator.user_agent,
      signature: signature.signature
    };
  }

  async fetchVideos() {
    try {
      const { xTtParams, userAgent } = await this.getSignature();

      console.log("🔑 X-TT-Params generated:", xTtParams.substring(0, 30) + "...");
      console.log("🌐 Browser User Agent:", userAgent.substring(0, 50) + "...");

      console.log("📡 Making API request to permanent URL...");
      const response = await this.makeRequest(userAgent, xTtParams);

      console.log("✅ API response received successfully");
      return response.data;

    } catch (error) {
      console.error("❌ Error fetching hashtag videos:", error.message);
      throw error;
    }
  }

  async makeRequest(userAgent, xTtParams) {
    const options = {
      method: "GET",
      url: CONFIG.PERMANENT_URL,
      headers: {
        "user-agent": userAgent,
        "x-tt-params": xTtParams,
        "referer": "https://www.tiktok.com/",
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin"
      },
    };

    return axios(options);
  }

  async cleanup() {
    if (this.signer) {
      console.log("🔒 Closing browser...");
      await this.signer.close();
      console.log("✅ Cleanup completed");
    }
  }

  displayResults(data) {
    console.log("\n📊 Results Summary:");

    if (data.itemList && data.itemList.length > 0) {
      console.log(`🎥 Found ${data.itemList.length} videos for hashtag`);
      console.log(`📄 Has more videos: ${data.hasMore ? 'Yes' : 'No'}`);

      if (data.hasMore) {
        console.log(`🔄 Next cursor: ${data.cursor}`);
      }

      // Show first few videos
      console.log("\n📹 Sample Videos:");
      data.itemList.slice(0, 3).forEach((video, index) => {
        console.log(`\n${index + 1}. 🎬 Video ID: ${video.id}`);
        console.log(`   👤 Author: @${video.author?.uniqueId || 'unknown'}`);
        console.log(`   📝 Description: ${video.desc?.substring(0, 50) || 'No description'}${video.desc?.length > 50 ? '...' : ''}`);
        console.log(`   👀 Views: ${video.stats?.playCount?.toLocaleString() || 'N/A'}`);
        console.log(`   ❤️ Likes: ${video.stats?.diggCount?.toLocaleString() || 'N/A'}`);
        console.log(`   💬 Comments: ${video.stats?.commentCount?.toLocaleString() || 'N/A'}`);
      });

      // Show hashtag info if available
      if (data.challengeInfo) {
        const challenge = data.challengeInfo;
        console.log(`\n🏷️ Hashtag Information:`);
        console.log(`   📛 Title: #${challenge.title || 'N/A'}`);
        console.log(`   📝 Description: ${challenge.desc || 'N/A'}`);
        console.log(`   👀 Total Views: ${challenge.stats?.viewCount?.toLocaleString() || 'N/A'}`);
        console.log(`   🎥 Total Videos: ${challenge.stats?.videoCount?.toLocaleString() || 'N/A'}`);
      }
    } else {
      console.log("📭 No videos found for this hashtag");
    }
  }
}

// Main execution function
async function main(challengeId) {
  const api = new HashtagVideosAPI(challengeId);

  try {
    await api.initialize();
    const data = await api.fetchVideos();
    api.displayResults(data);
    return data;
  } catch (error) {
    console.error("❌ Failed to fetch hashtag videos:", error.message);
    throw error;
  } finally {
    await api.cleanup();
  }
}

// Export for module usage
export default main;
export { HashtagVideosAPI };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const challengeId = process.argv[2] || CONFIG.CHALLENGE_ID;

  main(challengeId)
    .then(() => {
      console.log("\n✅ Hashtag videos example completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Example failed:", error.message);
      process.exit(1);
    });
}