import Signer from "../index.js";
import axios from "axios";

/**
 * TikTok Trending Videos API Example
 * Pattern: Basic URL building + signed_url
 *
 * This example demonstrates how to fetch trending/discover content.
 * Uses basic URL building with signed URL approach.
 */

// Configuration
const CONFIG = {
  // User-Agent helps prevent TikTok's captcha from triggering
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.53",

  // Base endpoint for trending content
  BASE_URL: "https://www.tiktok.com/node/share/discover",

  // Default query parameters
  DEFAULT_PARAMS: {
    aid: "1988",
    app_language: "en",
    app_name: "tiktok_web",
    battery_info: "1"
  }
};

class TrendingAPI {
  constructor() {
    this.signer = null;
  }

  async initialize() {
    console.log("🚀 Initializing TikTok Trending API");
    console.log("🔥 Fetching trending/discover content");
    console.log("🌐 User Agent:", CONFIG.USER_AGENT.substring(0, 50) + "...");

    this.signer = new Signer(null, CONFIG.USER_AGENT);

    console.log("⏳ Starting browser and loading TikTok scripts...");
    await this.signer.init();
    console.log("✅ Signer initialized successfully");
  }

  async getSignature(customParams = {}) {
    // Merge default parameters with custom parameters
    const params = {
      ...CONFIG.DEFAULT_PARAMS,
      ...customParams
    };

    const queryString = new URLSearchParams(params).toString();
    const unsignedUrl = `${CONFIG.BASE_URL}?${queryString}`;

    console.log("📝 Query parameters:", Object.keys(params).length, "parameters");
    console.log("🔗 Unsigned URL:", unsignedUrl.substring(0, 80) + "...");

    console.log("✍️ Generating signature...");
    const signature = await this.signer.sign(unsignedUrl);

    const navigator = await this.signer.navigator();

    return {
      signedUrl: signature.signed_url,
      userAgent: navigator.user_agent,
      signature: signature.signature,
      verifyFp: signature.verify_fp,
      xBogus: signature["x-bogus"]
    };
  }

  async fetchTrending(options = {}) {
    const {
      category = 'general',
      count = 20,
      refreshType = 0,
      insertIds = ''
    } = options;

    try {
      console.log(`🔥 Fetching trending content (category: ${category})`);

      const customParams = {};

      // Add optional parameters
      if (count !== 20) customParams.count = count;
      if (refreshType !== 0) customParams.refreshType = refreshType;
      if (insertIds) customParams.insertIds = insertIds;

      const { signedUrl, userAgent } = await this.getSignature(customParams);

      console.log("🔗 Signed URL generated:", signedUrl.substring(0, 100) + "...");
      console.log("🌐 Browser User Agent:", userAgent.substring(0, 50) + "...");

      console.log("📡 Making API request with signed URL...");
      const response = await this.makeRequest(userAgent, signedUrl);

      console.log("✅ API response received successfully");
      return response.data;

    } catch (error) {
      console.error("❌ Error fetching trending content:", error.message);

      // Enhanced error handling
      if (error.response) {
        console.error("📱 Response status:", error.response.status);
        console.error("📄 Response headers:", error.response.headers);

        if (error.response.status === 403) {
          console.error("🚫 Access forbidden - possibly blocked or rate limited");
        } else if (error.response.status === 429) {
          console.error("⏰ Rate limited - try again later");
        }
      }

      throw error;
    }
  }

  async makeRequest(userAgent, signedUrl) {
    const options = {
      method: "GET",
      url: signedUrl,
      headers: {
        "user-agent": userAgent,
        "referer": "https://www.tiktok.com/",
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-ch-ua": '"Chromium";v="105", "Not)A;Brand";v="8"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest"
      },
      timeout: 30000, // 30 second timeout
      validateStatus: function (status) {
        return status < 500; // Resolve only if the status code is less than 500
      }
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
    console.log("\n📊 Trending Results Summary:");

    // Handle different response structures
    let videos = [];

    if (data.itemList) {
      videos = data.itemList;
    } else if (data.items) {
      videos = data.items;
    } else if (Array.isArray(data)) {
      videos = data;
    } else if (data.body && data.body.itemList) {
      videos = data.body.itemList;
    } else if (data.body && Array.isArray(data.body)) {
      // Handle the specific structure: { statusCode: 0, body: [{ exploreList: [...] }, ...] }
      console.log(`🔍 Found ${data.body.length} explore sections`);

      data.body.forEach((section, sectionIndex) => {
        if (section.exploreList && Array.isArray(section.exploreList)) {
          console.log(`   Section ${sectionIndex + 1}: ${section.exploreList.length} items`);
          videos.push(...section.exploreList);
        }
      });
    }

    if (videos && videos.length > 0) {
      console.log(`🔥 Found ${videos.length} trending items`);

      // Determine if these are video items or card items
      const hasCardItems = videos.some(item => item.cardItem);

      if (hasCardItems) {
        // Handle card-based structure (creators/users)
        console.log("\n👥 Trending Creators/Content:");
        videos.slice(0, 10).forEach((item, index) => {
          const card = item.cardItem;
          if (card) {
            console.log(`\n${index + 1}. 🎬 ID: ${card.id || 'N/A'}`);
            console.log(`   📛 Title: ${card.title || 'N/A'}`);
            console.log(`   👤 Subtitle: ${card.subTitle || 'N/A'}`);
            console.log(`   📝 Description: ${card.description || 'No description'}`);
            console.log(`   🔗 Link: ${card.link || 'N/A'}`);
            console.log(`   🎭 Type: ${card.type || 'N/A'}`);

            if (card.cover) {
              console.log(`   🖼️ Cover: ${card.cover.substring(0, 80)}...`);
            }

            if (card.round !== undefined) {
              console.log(`   ⭕ Round: ${card.round ? 'Yes' : 'No'}`);
            }

            if (card.extraInfo) {
              console.log(`   ℹ️ Extra Info: ${Object.keys(card.extraInfo).length} fields`);
            }
          }
        });
      } else {
        // Handle traditional video structure
        console.log("\n🎬 Trending Videos:");
        videos.slice(0, 10).forEach((video, index) => {
          console.log(`\n${index + 1}. 🎬 Video ID: ${video.id || video.aweme_id || 'N/A'}`);

          if (video.author) {
            console.log(`   👤 Author: @${video.author.uniqueId || video.author.unique_id || 'unknown'}`);
            console.log(`   ✨ Display Name: ${video.author.nickname || video.author.nick_name || 'N/A'}`);
          }

          console.log(`   📝 Description: ${(video.desc || video.description || '').substring(0, 60) || 'No description'}${(video.desc || video.description || '').length > 60 ? '...' : ''}`);

          if (video.createTime || video.create_time) {
            const createTime = video.createTime || video.create_time;
            console.log(`   📅 Created: ${new Date(createTime * 1000).toLocaleDateString()}`);
          }

          if (video.stats || video.statistics) {
            const stats = video.stats || video.statistics;
            console.log(`   👀 Views: ${(stats.playCount || stats.play_count || 0).toLocaleString()}`);
            console.log(`   ❤️ Likes: ${(stats.diggCount || stats.digg_count || 0).toLocaleString()}`);
            console.log(`   💬 Comments: ${(stats.commentCount || stats.comment_count || 0).toLocaleString()}`);
            console.log(`   🔄 Shares: ${(stats.shareCount || stats.share_count || 0).toLocaleString()}`);
          }

          if (video.music && video.music.title) {
            console.log(`   🎵 Music: ${video.music.title}`);
          }

          if (video.video && video.video.duration) {
            console.log(`   ⏱️ Duration: ${video.video.duration}s`);
          }

          // Show hashtags if available
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
      }

      // Show additional metadata if available
      if (data.hasMore !== undefined) {
        console.log(`\n📄 Has more content: ${data.hasMore ? 'Yes' : 'No'}`);
      }

      if (data.cursor) {
        console.log(`🔄 Next cursor: ${data.cursor}`);
      }

    } else {
      console.log("📭 No trending content found");
      console.log("🔍 Raw response structure:");
      console.log(Object.keys(data));

      // Provide more detailed debugging for the specific structure
      if (data.statusCode !== undefined) {
        console.log(`📊 Status Code: ${data.statusCode}`);
      }

      if (data.body && Array.isArray(data.body)) {
        console.log(`📋 Body contains ${data.body.length} sections:`);
        data.body.forEach((section, index) => {
          console.log(`   Section ${index + 1}:`, Object.keys(section));
          if (section.exploreList) {
            console.log(`     - exploreList: ${section.exploreList.length} items`);
          }
          if (section.pageState) {
            console.log(`     - pageState:`, Object.keys(section.pageState));
          }
        });
      }
    }
  }

  // Method to get trending hashtags/challenges
  async fetchTrendingHashtags() {
    try {
      console.log("🏷️ Fetching trending hashtags...");

      const customParams = {
        ...CONFIG.DEFAULT_PARAMS,
        from_page: "hashtag",
        aid: "1988"
      };

      // Use a different endpoint for hashtags
      const queryString = new URLSearchParams(customParams).toString();
      const unsignedUrl = `https://www.tiktok.com/node/share/hashtag?${queryString}`;

      console.log("🔗 Hashtag URL:", unsignedUrl.substring(0, 80) + "...");

      const signature = await this.signer.sign(unsignedUrl);
      const navigator = await this.signer.navigator();

      const response = await this.makeRequest(navigator.user_agent, signature.signed_url);

      console.log("✅ Hashtag response received");
      return response.data;

    } catch (error) {
      console.error("❌ Error fetching trending hashtags:", error.message);
      throw error;
    }
  }
}

// Main execution function
async function main(options = {}) {
  const api = new TrendingAPI();

  try {
    await api.initialize();

    if (options.hashtags) {
      const data = await api.fetchTrendingHashtags();
      console.log("🏷️ Trending hashtags data:", data);
      return data;
    } else {
      const data = await api.fetchTrending(options);
      console.log(data);
      api.displayResults(data);
      return data;
    }
  } catch (error) {
    console.error("❌ Failed to fetch trending content:", error.message);
    throw error;
  } finally {
    await api.cleanup();
  }
}

// Export for module usage
export default main;
export { TrendingAPI };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const hashtags = process.argv.includes('--hashtags');
  const count = parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1]) || 20;

  main({ hashtags, count })
    .then(() => {
      console.log("\n✅ Trending example completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Example failed:", error.message);
      process.exit(1);
    });
}