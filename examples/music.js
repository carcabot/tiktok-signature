import Signer from "../index.js";
import axios from "axios";

/**
 * TikTok Music/Audio Videos API Example
 * Pattern: Permanent URL + x-tt-params header only
 *
 * This example demonstrates how to fetch videos that use a specific music/audio track.
 * Uses the permanent URL approach where x-tt-params contains the signed parameters.
 */

// Configuration
const CONFIG = {
  // Default music ID to fetch videos for
  MUSIC_ID: "7034143722082192134",

  // User-Agent helps prevent TikTok's captcha from triggering
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36 Edg/101.0.1210.53",

  // Permanent URL - always use this exact URL for the final API request
  PERMANENT_URL: "https://m.tiktok.com/api/music/item_list/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F101.0.4951.64%20Safari%2F537.36%20Edg%2F101.0.1210.53&channel=tiktok_web&cookie_enabled=true&device_id=7002566096994190854&device_platform=web_pc&focus_state=false&from_page=music&history_len=1&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=RO&referer=&region=RO&screen_height=1080&screen_width=1920&tz_name=Europe%2FBucharest&verifyFp=verify_dca8729afe5c502257ed30b0b070dbdb&webcast_language=en&msToken=K8Xf-t_4RZ5n27zHsUPRyDIjpHQtfPeuHSvtbWzz0D0CQkX1UEyEdV0Xgx5BdbFPqKZ2McVCdlo1RM_u3o9FRglKoFa7TLZz2Yhd_fYRgWKhQDAq1TxQwLSTCz7Jp-EzVhopdNFO&X-Bogus=DFSzswVOLbUANCTQSwQvy2XyYJAm&_signature=_02B4Z6wo00001S9DBBwAAIDADOIqsG3-iK0vQwCAAClJd0",

  // Request parameters for signing
  DEFAULT_PARAMS: {
    aid: 1988,
    count: 30,
    cursor: 0,
    secUid: "",
    cookie_enabled: true,
    screen_width: 1920,
    screen_height: 1080,
    browser_language: "en-US",
    browser_platform: "Win32",
    browser_name: "Mozilla",
    browser_version: "5.0",
    browser_online: true,
    timezone_name: "Europe/London"
  }
};

class MusicVideosAPI {
  constructor(musicId = CONFIG.MUSIC_ID) {
    this.musicId = musicId;
    this.signer = null;
    this.musicInfo = null;
  }

  async initialize() {
    console.log("🚀 Initializing TikTok Music Videos API");
    console.log("🎵 Music ID:", this.musicId);
    console.log("🌐 User Agent:", CONFIG.USER_AGENT.substring(0, 50) + "...");

    this.signer = new Signer(null, CONFIG.USER_AGENT);

    console.log("⏳ Starting browser and loading TikTok scripts...");
    await this.signer.init();
    console.log("✅ Signer initialized successfully");
  }

  async getSignature(customParams = {}) {
    const params = {
      ...CONFIG.DEFAULT_PARAMS,
      musicID: this.musicId,
      ...customParams
    };

    const queryString = new URLSearchParams(params).toString();
    const unsignedUrl = `https://m.tiktok.com/api/music/item_list/?${queryString}`;

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

  async fetchMusicVideos(options = {}) {
    const {
      count = CONFIG.DEFAULT_PARAMS.count,
      cursor = CONFIG.DEFAULT_PARAMS.cursor
    } = options;

    try {
      console.log(`🎵 Fetching videos for music ID: ${this.musicId}`);
      console.log(`📊 Requesting ${count} videos starting from cursor ${cursor}`);

      const { xTtParams, userAgent } = await this.getSignature({
        count,
        cursor
      });

      console.log("🔑 X-TT-Params generated:", xTtParams.substring(0, 30) + "...");
      console.log("🌐 Browser User Agent:", userAgent.substring(0, 50) + "...");

      console.log("📡 Making API request to permanent URL...");
      const response = await this.makeRequest(userAgent, xTtParams);

      console.log("✅ API response received successfully");

      // Extract music info if available
      this.extractMusicInfo(response.data);

      return response.data;

    } catch (error) {
      console.error("❌ Error fetching music videos:", error.message);

      // Enhanced error handling
      if (error.response) {
        console.error("📱 Response status:", error.response.status);

        if (error.response.status === 404) {
          console.error("🎵 Music not found - check music ID");
        } else if (error.response.status === 403) {
          console.error("🚫 Access forbidden - music may be restricted");
        }
      }

      throw error;
    }
  }

  extractMusicInfo(data) {
    // Try to extract music information from various possible locations
    if (data.musicInfo) {
      this.musicInfo = data.musicInfo;
    } else if (data.music) {
      this.musicInfo = data.music;
    } else if (data.itemList && data.itemList.length > 0 && data.itemList[0].music) {
      this.musicInfo = data.itemList[0].music;
    }

    if (this.musicInfo) {
      console.log("🎵 Music info extracted:", this.musicInfo.title || 'Unknown title');
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
    console.log("\n📊 Music Videos Results:");

    // Display music information if available
    if (this.musicInfo) {
      console.log("\n🎵 Music Information:");
      console.log(`   🎼 Title: ${this.musicInfo.title || 'Unknown'}`);
      console.log(`   🎤 Artist: ${this.musicInfo.authorName || this.musicInfo.author || 'Unknown'}`);
      console.log(`   🆔 Music ID: ${this.musicInfo.id || this.musicId}`);

      if (this.musicInfo.duration) {
        console.log(`   ⏱️ Duration: ${this.musicInfo.duration}s`);
      }

      if (this.musicInfo.original !== undefined) {
        console.log(`   ✨ Original Sound: ${this.musicInfo.original ? 'Yes' : 'No'}`);
      }

      if (this.musicInfo.playUrl) {
        console.log(`   🔗 Play URL: ${this.musicInfo.playUrl.length} available`);
      }

      if (this.musicInfo.coverThumb) {
        console.log(`   🖼️ Cover: ${this.musicInfo.coverThumb}`);
      }
    }

    if (data.itemList && data.itemList.length > 0) {
      console.log(`\n🎥 Found ${data.itemList.length} videos using this music`);
      console.log(`📄 Has more videos: ${data.hasMore ? 'Yes' : 'No'}`);

      if (data.hasMore && data.cursor) {
        console.log(`🔄 Next cursor: ${data.cursor}`);
      }

      // Show video details
      console.log("\n📹 Videos Using This Music:");
      data.itemList.slice(0, 8).forEach((video, index) => {
        console.log(`\n${index + 1}. 🎬 Video ID: ${video.id}`);
        console.log(`   👤 Author: @${video.author?.uniqueId || 'unknown'}`);

        if (video.author?.nickname) {
          console.log(`   ✨ Display Name: ${video.author.nickname}`);
        }

        console.log(`   📝 Description: ${video.desc?.substring(0, 50) || 'No description'}${video.desc?.length > 50 ? '...' : ''}`);
        console.log(`   📅 Created: ${new Date(video.createTime * 1000).toLocaleDateString()}`);

        if (video.stats) {
          console.log(`   👀 Views: ${video.stats.playCount?.toLocaleString() || 'N/A'}`);
          console.log(`   ❤️ Likes: ${video.stats.diggCount?.toLocaleString() || 'N/A'}`);
          console.log(`   💬 Comments: ${video.stats.commentCount?.toLocaleString() || 'N/A'}`);
          console.log(`   🔄 Shares: ${video.stats.shareCount?.toLocaleString() || 'N/A'}`);
        }

        if (video.video?.duration) {
          console.log(`   ⏱️ Video Duration: ${video.video.duration}s`);
        }

        // Show if this is the original sound
        if (video.music?.original) {
          console.log(`   🎵 Original Sound Creator: Yes`);
        }

        // Show video effects if available
        if (video.effectStickers && video.effectStickers.length > 0) {
          console.log(`   ✨ Effects: ${video.effectStickers.length} effects used`);
        }
      });

      // Show music statistics if available
      if (data.musicStats) {
        console.log(`\n📊 Music Usage Statistics:`);
        console.log(`   🎥 Total Videos: ${data.musicStats.videoCount?.toLocaleString() || 'N/A'}`);
        console.log(`   👀 Total Views: ${data.musicStats.viewCount?.toLocaleString() || 'N/A'}`);
      }

    } else {
      console.log("📭 No videos found using this music");

      if (data.statusCode) {
        console.log(`📱 Status Code: ${data.statusCode}`);
      }

      if (data.statusMsg) {
        console.log(`📄 Status Message: ${data.statusMsg}`);
      }
    }
  }

  // Method to fetch music information only (without videos)
  async fetchMusicInfo() {
    try {
      console.log(`🎵 Fetching music information for ID: ${this.musicId}`);

      const { xTtParams, userAgent } = await this.getSignature({
        count: 1, // Minimal count to just get music info
        cursor: 0
      });

      const response = await this.makeRequest(userAgent, xTtParams);
      this.extractMusicInfo(response.data);

      return this.musicInfo;

    } catch (error) {
      console.error("❌ Error fetching music info:", error.message);
      throw error;
    }
  }

  // Method to fetch videos in batches
  async fetchMusicVideosBatch(batchSize = 30, maxBatches = 5) {
    console.log(`📚 Fetching music videos in batches (${batchSize} per batch, max ${maxBatches} batches)`);

    let cursor = 0;
    let allVideos = [];
    let hasMore = true;
    let batchCount = 0;

    while (hasMore && batchCount < maxBatches) {
      batchCount++;
      console.log(`\n📄 Fetching batch ${batchCount}...`);

      const data = await this.fetchMusicVideos({
        count: batchSize,
        cursor: cursor
      });

      if (data.itemList && data.itemList.length > 0) {
        allVideos.push(...data.itemList);
        console.log(`✅ Batch ${batchCount}: ${data.itemList.length} videos fetched`);

        hasMore = data.hasMore;
        cursor = data.cursor || (cursor + data.itemList.length);
      } else {
        hasMore = false;
      }
    }

    console.log(`\n🎯 Total videos collected: ${allVideos.length}`);
    return {
      itemList: allVideos,
      totalBatches: batchCount,
      hasMore: hasMore,
      musicInfo: this.musicInfo
    };
  }

  // Method to search for music by title or artist
  async searchMusic(searchTerm) {
    console.log(`🔍 Searching for music: ${searchTerm}`);

    try {
      // This would require a different endpoint for music search
      // For now, we'll try the current music ID and see if it matches
      const musicInfo = await this.fetchMusicInfo();

      if (musicInfo) {
        const title = (musicInfo.title || '').toLowerCase();
        const artist = (musicInfo.authorName || musicInfo.author || '').toLowerCase();
        const search = searchTerm.toLowerCase();

        if (title.includes(search) || artist.includes(search)) {
          console.log(`✅ Found matching music: ${musicInfo.title} by ${musicInfo.authorName}`);
          return musicInfo;
        }
      }

      console.log(`❌ No match found for: ${searchTerm}`);
      return null;

    } catch (error) {
      console.error("❌ Error searching music:", error.message);
      return null;
    }
  }
}

// Main execution function
async function main(musicId, options = {}) {
  const api = new MusicVideosAPI(musicId);

  try {
    await api.initialize();

    if (options.infoOnly) {
      const musicInfo = await api.fetchMusicInfo();
      console.log("\n🎵 Music Information:", musicInfo);
      return musicInfo;
    } else if (options.batch) {
      const data = await api.fetchMusicVideosBatch(options.batchSize, options.maxBatches);
      api.displayResults(data);
      return data;
    } else if (options.search) {
      const musicInfo = await api.searchMusic(musicId); // Use musicId as search term
      return musicInfo;
    } else {
      const data = await api.fetchMusicVideos(options);
      api.displayResults(data);
      return data;
    }
  } catch (error) {
    console.error("❌ Failed to fetch music videos:", error.message);
    throw error;
  } finally {
    await api.cleanup();
  }
}

// Export for module usage
export default main;
export { MusicVideosAPI };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const musicId = process.argv[2] || CONFIG.MUSIC_ID;
  const infoOnly = process.argv.includes('--info');
  const batch = process.argv.includes('--batch');
  const search = process.argv.includes('--search');
  const count = parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1]) || 30;

  main(musicId, { infoOnly, batch, search, count })
    .then(() => {
      console.log("\n✅ Music videos example completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Example failed:", error.message);
      process.exit(1);
    });
}