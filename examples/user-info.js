import Signer from "../index.js";
import axios from "axios";
import querystring from "querystring";

/**
 * TikTok User Information API Example
 * Pattern: Permanent URL merging + both x-tt-params and signed_url
 *
 * This example demonstrates how to fetch detailed user information.
 * Uses permanent URL parameter merging with signed URL approach.
 */

// Configuration
const CONFIG = {
  // Default username to fetch info for
  USERNAME: "tiktok",

  // User-Agent helps prevent TikTok's captcha from triggering
  USER_AGENT: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",

  // Permanent URL template with comprehensive parameters
  PERMANENT_URL: "https://www.tiktok.com/api/user/detail/?WebIdLastTime=1752132549&abTestVersion=%5Bobject%20Object%5D&aid=1988&appType=m&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F138.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=false&device_id=7525351986981094934&device_platform=web_pc&focus_state=true&from_page=user&history_len=3&is_fullscreen=false&is_page_visible=true&language=en&locateItemID=7195062981313580293&needAudienceControl=true&odinId=7525351908476732438&os=mac&priority_region=&referer=&region=RO&screen_height=1117&screen_width=1728&secUid=&tz_name=Europe%2FBucharest&uniqueId=realestkyiv&user_is_login=false&webcast_language=en&msToken=U8MGxbgdE4RkU4lVFBJxBvVhyRxZ5hMru4gX1ec7MwqMZeD981yMgSagMxZLexXLMyrCeIzw5yAFHvUpy72rUFzggoxGivTarQfgwD7Rh68DGiYBywshxH1CSwPTM_cvXpH_c6as5eLBD_tXLFppAikM&X-Bogus=DFSzswVYWdxANGP5CtmFF2lUrn/4&X-Gnarly=MKFGyWhSW6LFl8QBds0j667bFRY2n013Z4wG0kwE7E3oYWtgi7nbxDqpGxYuFBfal-FTlPQrY2eTSNHZb2e0boW5rh8--UNsg531QFkaf5xNnm21JDKkB7LZSpUCk7wi7kn1fMNryzNqL4y9dr1mIrmGw6hl3vLGIUrlZH4/XEXbGcQDbAsRU2GxP2HAYbrSu98vJNKV7gEE/aS94ZGvhZUNxm6H9n87ObMJl4PGoRpx6xtXG/9CihUH8zKwXdnNZNKoCrNkYCYIkvOOfzJ3TPqIUov6VWRuDyP4oYrbyPlF",

  // Default request parameters
  DEFAULT_PARAMS: {
    device_id: '7236846595559933400',
    cursor: 0,
    count: 30
  }
};

class UserInfoAPI {
  constructor(username = CONFIG.USERNAME) {
    this.username = username;
    this.secUid = null; // Will be resolved from username
    this.signer = null;
    this.permanentParams = null;
  }

  async initialize() {
    console.log("🚀 Initializing TikTok User Info API");
    console.log("👤 Username:", this.username);
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
      uniqueId: this.username,
      secUid: this.secUid || "", // Use secUid if available
      ...customParams
    };

    const queryString = new URLSearchParams(mergedParams).toString();
    const unsignedUrl = `https://www.tiktok.com/api/user/detail?${queryString}`;

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

  async fetchUserInfo(options = {}) {
    const {
      includeVideos = false,
      videoCount = 10
    } = options;

    try {
      console.log(`👤 Fetching user information for: ${this.username}`);

      if (includeVideos) {
        console.log(`🎥 Including ${videoCount} recent videos`);
      }

      const customParams = {};
      if (includeVideos) {
        customParams.count = videoCount;
      }

      const { xTtParams, signedUrl, userAgent } = await this.getSignature(customParams);

      console.log("🔑 X-TT-Params generated:", xTtParams.substring(0, 30) + "...");
      console.log("🔗 Signed URL generated:", signedUrl.substring(0, 100) + "...");
      console.log("🌐 Browser User Agent:", userAgent.substring(0, 50) + "...");

      console.log("📡 Making API request with signed URL...");
      const response = await this.makeRequest(userAgent, xTtParams, signedUrl);

      console.log("✅ API response received successfully");

      // Extract and store secUid for future requests
      if (response.data.userInfo && response.data.userInfo.user && response.data.userInfo.user.secUid) {
        this.secUid = response.data.userInfo.user.secUid;
        console.log("🔑 SecUID extracted:", this.secUid.substring(0, 20) + "...");
      }

      return response.data;

    } catch (error) {
      console.error("❌ Error fetching user information:", error.message);

      // Enhanced error handling
      if (error.response) {
        console.error("📱 Response status:", error.response.status);

        if (error.response.status === 404) {
          console.error("👤 User not found - check username");
        } else if (error.response.status === 403) {
          console.error("🚫 Access forbidden - user may be private or blocked");
        }
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
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest"
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
    console.log("\n📊 User Information Results:");
    
    if (data.userInfo && data.userInfo.user) {
      const user = data.userInfo.user;
      const stats = data.userInfo.stats || {};

      console.log("\n👤 User Profile:");
      console.log(`   📛 Username: @${user.uniqueId || 'N/A'}`);
      console.log(`   ✨ Display Name: ${user.nickname || 'N/A'}`);
      console.log(`   🆔 User ID: ${user.id || 'N/A'}`);
      console.log(`   🔑 SecUID: ${user.secUid ? user.secUid.substring(0, 20) + '...' : 'N/A'}`);

      console.log("\n📝 Profile Details:");
      console.log(`   📄 Bio: ${user.signature || 'No bio'}`);
      console.log(`   ✅ Verified: ${user.verified ? 'Yes' : 'No'}`);
      console.log(`   🔒 Private Account: ${user.privateAccount ? 'Yes' : 'No'}`);
      console.log(`   🎂 TTSeller: ${user.ttSeller ? 'Yes' : 'No'}`);

      if (user.avatarThumb) {
        console.log(`   🖼️ Avatar: ${user.avatarThumb}`);
      }

      console.log("\n📊 Statistics:");
      console.log(`   👥 Followers: ${stats.followerCount?.toLocaleString() || 'N/A'}`);
      console.log(`   👤 Following: ${stats.followingCount?.toLocaleString() || 'N/A'}`);
      console.log(`   ❤️ Total Likes: ${stats.heartCount?.toLocaleString() || 'N/A'}`);
      console.log(`   🎥 Video Count: ${stats.videoCount?.toLocaleString() || 'N/A'}`);

      if (stats.diggCount !== undefined) {
        console.log(`   👍 Digg Count: ${stats.diggCount?.toLocaleString() || 'N/A'}`);
      }

      // Show additional user details if available
      if (user.language) {
        console.log(`   🌐 Language: ${user.language}`);
      }

      if (user.region) {
        console.log(`   🌍 Region: ${user.region}`);
      }

      // Show recent videos if available
      if (data.itemList && data.itemList.length > 0) {
        console.log(`\n🎥 Recent Videos (${data.itemList.length}):`);

        data.itemList.slice(0, 5).forEach((video, index) => {
          console.log(`\n${index + 1}. 🎬 Video ID: ${video.id}`);
          console.log(`   📝 Description: ${video.desc?.substring(0, 50) || 'No description'}${video.desc?.length > 50 ? '...' : ''}`);
          console.log(`   📅 Created: ${new Date(video.createTime * 1000).toLocaleDateString()}`);

          if (video.stats) {
            console.log(`   👀 Views: ${video.stats.playCount?.toLocaleString() || 'N/A'}`);
            console.log(`   ❤️ Likes: ${video.stats.diggCount?.toLocaleString() || 'N/A'}`);
          }
        });
      }

    } else {
      console.log("❌ No user information found");
      console.log("🔍 Response structure:");
      console.log(Object.keys(data));

      if (data.statusCode) {
        console.log(`📱 Status Code: ${data.statusCode}`);
      }

      if (data.statusMsg) {
        console.log(`📄 Status Message: ${data.statusMsg}`);
      }
    }
  }

  // Method to search for a user by username variations
  async searchUser(searchTerm) {
    console.log(`🔍 Searching for user: ${searchTerm}`);

    // Try different variations of the username
    const variations = [
      searchTerm,
      searchTerm.toLowerCase(),
      searchTerm.replace(/[^a-zA-Z0-9._]/g, ''),
      searchTerm.replace(/\s+/g, '')
    ];

    for (const variation of variations) {
      try {
        console.log(`🔄 Trying variation: ${variation}`);
        this.username = variation;

        const data = await this.fetchUserInfo();

        if (data.userInfo && data.userInfo.user) {
          console.log(`✅ Found user with variation: ${variation}`);
          return data;
        }
      } catch (error) {
        console.log(`❌ Variation '${variation}' failed: ${error.message}`);
      }
    }

    throw new Error(`User not found with any variation of: ${searchTerm}`);
  }

  // Method to get user's relationship status (if available)
  async getUserRelationship() {
    if (!this.secUid) {
      console.log("⚠️ SecUID required for relationship info");
      return null;
    }

    try {
      console.log("💫 Fetching user relationship info...");

      const customParams = {
        type: 1, // relationship type
        secUid: this.secUid,
        scene: 21
      };

      const { xTtParams, signedUrl, userAgent } = await this.getSignature(customParams);

      // Use a different endpoint for relationship
      const relationshipUrl = signedUrl.replace('/user/detail', '/user/relation');

      const response = await this.makeRequest(userAgent, xTtParams, relationshipUrl);

      console.log("✅ Relationship info received");
      return response.data;

    } catch (error) {
      console.log("❌ Could not fetch relationship info:", error.message);
      return null;
    }
  }
}

// Main execution function
async function main(username, options = {}) {
  const api = new UserInfoAPI(username);

  try {
    await api.initialize();

    if (options.search) {
      const data = await api.searchUser(username);
      api.displayResults(data);
      return data;
    } else {
      const data = await api.fetchUserInfo(options);
      api.displayResults(data);

      // Optionally fetch relationship info
      if (options.includeRelationship && api.secUid) {
        const relationshipData = await api.getUserRelationship();
        if (relationshipData) {
          console.log("\n💫 Relationship Info:", relationshipData);
        }
      }

      return data;
    }
  } catch (error) {
    console.error("❌ Failed to fetch user information:", error.message);
    throw error;
  } finally {
    await api.cleanup();
  }
}

// Export for module usage
export default main;
export { UserInfoAPI };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const username = process.argv[2] || CONFIG.USERNAME;
  const includeVideos = process.argv.includes('--videos');
  const search = process.argv.includes('--search');
  const includeRelationship = process.argv.includes('--relationship');

  main(username, { includeVideos, search, includeRelationship })
    .then(() => {
      console.log("\n✅ User info example completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Example failed:", error.message);
      process.exit(1);
    });
}