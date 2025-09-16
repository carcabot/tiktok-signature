import Signer from "../index.js";
import axios from "axios";
import querystring from "querystring";

/**
 * TikTok User Videos API Example
 * Pattern: Permanent URL merging + both x-tt-params and signed_url
 *
 * This example demonstrates how to fetch videos for a specific user.
 * Uses permanent URL parameter merging with signed URL approach.
 */

// Configuration
const CONFIG = {
  // Get SEC_UID from: https://t.tiktok.com/api/user/detail/?aid=1988&uniqueId=username&language=en
  SEC_UID: "MS4wLjABAAAAQ09e6Ck9CQrQQYAPLehEKMlvVS8XzmGcbNHTGXsXIZSIj7Pe21eYtDq0nzKy6-5V",

  // User-Agent helps prevent TikTok's captcha from triggering
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.56",

  // Permanent URL template - contains base parameters
  PERMANENT_URL: "https://www.tiktok.com/api/post/item_list/?WebIdLastTime=1684959661&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F123.0.0.0%20Safari%2F537.36%20Edg%2F123.0.0.0&channel=tiktok_web&cookie_enabled=true&count=35&coverFormat=2&cursor=0&device_id=7236846595559933467&device_platform=web_pc&focus_state=true&from_page=user&history_len=8&is_fullscreen=false&is_page_visible=true&language=en&os=windows&priority_region=RO&referer=https%3A%2F%2Fwww.tiktok.com%2Fbusiness-suite%2Fmessages%3Ffrom%3Dhomepage%26lang%3Den&region=RO&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fbusiness-suite%2Fmessages%3Ffrom%3Dhomepage%26lang%3Den&screen_height=1080&screen_width=1920&secUid=MS4wLjABAAAATdiadghBG5ZZqRrY93j0-jyzqPW_toWf5ir6b9aeB64HebodSB1scEXNpC020bPq&tz_name=Europe%2FBucharest&verifyFp=verify_lv1bd0o8_AA3QC5jZ_70uk_4haw_BYSy_P6oIpsr0LMUE&webcast_language=en&msToken=riqlJPr42AMSGAwHu9g9z5PhCqn3Hzp-CjRpNH8XqPTcwNCehHnQqvP5BAgx7HwkuQfAcVxbttMfK3fGHZvUXYB__GZK7iWaYaItDzaDJxeVock0JIurABWe1b5T30PY61UM&X-Bogus=DFSzswVurstANHsMt5bgOw4m8iGH&_signature=_02B4Z6wo00001tPwkyAAAIDBIzv5q2eTgMbT8JeAANLu81",

  // Default request parameters
  DEFAULT_PARAMS: {
    count: 30,
    cursor: 0,
    device_id: '7165118680723998211',
  }
};

class UserVideosAPI {
  constructor(secUid = CONFIG.SEC_UID) {
    this.secUid = secUid;
    this.signer = null;
    this.permanentParams = null;
  }

  async initialize() {
    console.log("🚀 Initializing TikTok User Videos API");
    console.log("👤 SEC UID:", this.secUid.substring(0, 20) + "...");
    console.log("🌐 User Agent:", CONFIG.USER_AGENT.substring(0, 50) + "...");

    // Parse permanent URL to extract base parameters
    this.parsePermanentUrl();

    this.signer = new Signer(null, CONFIG.USER_AGENT);

    console.log("⏳ Starting browser and loading TikTok scripts...");
    await this.signer.init();
    console.log("✅ Signer initialized successfully");
  }

  parsePermanentUrl() {
    const parsedUrl = new URL(CONFIG.PERMANENT_URL);
    this.permanentParams = querystring.parse(parsedUrl.search.slice(1));

    console.log("📋 Parsed", Object.keys(this.permanentParams).length, "parameters from permanent URL");
  }

  async getSignature(customParams = {}) {
    // Merge permanent parameters with custom parameters
    const mergedParams = {
      ...this.permanentParams,
      ...CONFIG.DEFAULT_PARAMS,
      secUid: this.secUid,
      ...customParams
    };

    const queryString = new URLSearchParams(mergedParams).toString();
    const unsignedUrl = `https://www.tiktok.com/api/post/item_list/?${queryString}`;

    console.log("📝 Total parameters:", Object.keys(mergedParams).length);
    console.log("🔗 Unsigned URL:", unsignedUrl.substring(0, 100) + "...");

    console.log("✍️ Generating signature...");
    const signature = await this.signer.sign(unsignedUrl);

    const navigator = await this.signer.navigator();

    return {
      xTtParams: signature["x-tt-params"],
      signedUrl: signature.signed_url,
      userAgent: navigator.user_agent,
      signature: signature.signature,
      verifyFp: signature.verify_fp
    };
  }

  async fetchVideos(options = {}) {
    const {
      count = CONFIG.DEFAULT_PARAMS.count,
      cursor = CONFIG.DEFAULT_PARAMS.cursor,
      coverFormat = 2
    } = options;

    try {
      console.log(`📊 Fetching ${count} videos starting from cursor ${cursor}`);

      const { xTtParams, signedUrl, userAgent } = await this.getSignature({
        count,
        cursor,
        coverFormat
      });

      console.log("🔑 X-TT-Params generated:", xTtParams.substring(0, 30) + "...");
      console.log("🔗 Signed URL generated:", signedUrl.substring(0, 100) + "...");
      console.log("🌐 Browser User Agent:", userAgent.substring(0, 50) + "...");

      console.log("📡 Making API request with signed URL...");
      const response = await this.makeRequest(userAgent, xTtParams, signedUrl);

      console.log("✅ API response received successfully");
      return response.data;

    } catch (error) {
      console.error("❌ Error fetching user videos:", error.message);

      // Enhanced error handling
      if (error.response) {
        console.error("📱 Response status:", error.response.status);
        console.error("📄 Response data:", error.response.data);
      }

      throw error;
    }
  }

  async makeRequest(userAgent, xTtParams, signedUrl) {
    const options = {
      method: "GET",
      url: signedUrl,
      headers: {
        "user-agent": userAgent,
        "x-tt-params": xTtParams,
        "referer": "https://www.tiktok.com/",
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin"
      },
      timeout: 30000 // 30 second timeout
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
    console.log(data);
    if (data.itemList && data.itemList.length > 0) {
      console.log(`🎥 Found ${data.itemList.length} videos`);
      console.log(`📄 Has more videos: ${data.hasMore ? 'Yes' : 'No'}`);

      if (data.hasMore && data.cursor) {
        console.log(`🔄 Next cursor: ${data.cursor}`);
      }

      // Show detailed video information
      console.log("\n📹 Video Details:");
      data.itemList.slice(0, 5).forEach((video, index) => {
        console.log(`\n${index + 1}. 🎬 Video ID: ${video.id}`);
        console.log(`   📝 Description: ${video.desc?.substring(0, 60) || 'No description'}${video.desc?.length > 60 ? '...' : ''}`);
        console.log(`   📅 Created: ${new Date(video.createTime * 1000).toLocaleDateString()}`);

        if (video.stats) {
          console.log(`   👀 Views: ${video.stats.playCount?.toLocaleString() || 'N/A'}`);
          console.log(`   ❤️ Likes: ${video.stats.diggCount?.toLocaleString() || 'N/A'}`);
          console.log(`   💬 Comments: ${video.stats.commentCount?.toLocaleString() || 'N/A'}`);
          console.log(`   🔄 Shares: ${video.stats.shareCount?.toLocaleString() || 'N/A'}`);
        }

        if (video.video?.duration) {
          console.log(`   ⏱️ Duration: ${video.video.duration}s`);
        }

        if (video.music?.title) {
          console.log(`   🎵 Music: ${video.music.title}`);
        }

        // Show hashtags
        if (video.textExtra && video.textExtra.length > 0) {
          const hashtags = video.textExtra
            .filter(tag => tag.hashtagName)
            .map(tag => `#${tag.hashtagName}`)
            .slice(0, 3)
            .join(' ');
          if (hashtags) {
            console.log(`   🏷️ Tags: ${hashtags}`);
          }
        }
      });

      // Show user stats if available
      if (data.userInfo) {
        const user = data.userInfo;
        console.log(`\n👤 User Information:`);
        console.log(`   📛 Username: @${user.uniqueId || 'N/A'}`);
        console.log(`   ✨ Display Name: ${user.nickname || 'N/A'}`);
        console.log(`   ✅ Verified: ${user.verified ? 'Yes' : 'No'}`);
      }
    } else {
      console.log("📭 No videos found for this user");
    }
  }

  // Utility method to fetch multiple pages
  async fetchMultiplePages(maxPages = 3, videosPerPage = 30) {
    console.log(`📚 Fetching up to ${maxPages} pages with ${videosPerPage} videos each`);

    let cursor = 0;
    let allVideos = [];
    let hasMore = true;

    for (let page = 1; page <= maxPages && hasMore; page++) {
      console.log(`\n📄 Fetching page ${page}...`);

      const data = await this.fetchVideos({
        count: videosPerPage,
        cursor: cursor
      });

      if (data.itemList && data.itemList.length > 0) {
        allVideos.push(...data.itemList);
        console.log(`✅ Page ${page}: ${data.itemList.length} videos fetched`);

        hasMore = data.hasMore;
        cursor = data.cursor || (cursor + data.itemList.length);
      } else {
        hasMore = false;
      }
    }

    console.log(`\n🎯 Total videos collected: ${allVideos.length}`);
    return {
      itemList: allVideos,
      totalPages: Math.min(maxPages, hasMore ? maxPages : page - 1),
      hasMore: hasMore
    };
  }
}

// Main execution function
async function main(secUid, options = {}) {
  const api = new UserVideosAPI(secUid);

  try {
    await api.initialize();

    if (options.multiPage) {
      const data = await api.fetchMultiplePages(options.maxPages, options.videosPerPage);
      api.displayResults(data);
      return data;
    } else {
      const data = await api.fetchVideos(options);
      api.displayResults(data);
      return data;
    }
  } catch (error) {
    console.error("❌ Failed to fetch user videos:", error.message);
    throw error;
  } finally {
    await api.cleanup();
  }
}

// Export for module usage
export default main;
export { UserVideosAPI };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const secUid = process.argv[2] || CONFIG.SEC_UID;
  const count = parseInt(process.argv[3]) || 30;

  main(secUid, { count })
    .then(() => {
      console.log("\n✅ User videos example completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Example failed:", error.message);
      process.exit(1);
    });
}