import Signer from "../index.js";
import axios from "axios";
import querystring from "querystring";

/**
 * TikTok Video Comments API Example
 * Pattern: Permanent URL merging + both x-tt-params and signed_url + specific referer
 *
 * This example demonstrates how to fetch comments for a specific video.
 * Uses permanent URL parameter merging with signed URL approach and requires specific video referer.
 */

// Configuration
const CONFIG = {
  // Default video ID to fetch comments for
  VIDEO_ID: "7517698113180617989",

  // MSToken is required for comments - you need to extract this from browser
  MSTOKEN: "G1lr_8nRB3udnK_fFzgBD7sxvc0PK6Osokd1IJMaVPVcoB4mwSW-D6MQjTdoJ2o20PLt_MWNgtsAr095wVSShdmn_XVFS34bURvakVglDyWAHncoV_jVJCRdiJRdbJBi_E_KD_G8vpFF9-aOaJrk",

  // User-Agent helps prevent TikTok's captcha from triggering
  USER_AGENT: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",

  // Permanent URL template with comprehensive parameters
  PERMANENT_URL: "https://www.tiktok.com/api/comment/list/?WebIdLastTime=1752132549&aid=1988&app_language=en&app_name=tiktok_web&aweme_id=7206067410766433541&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F138.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&count=20&cursor=0&current_region=US&device_id=7525351986981094934&device_platform=web_pc&focus_state=true&from_page=video&history_len=3&is_fullscreen=false&is_page_visible=true&language=en&os=mac&priority_region=US&referer=&region=US&screen_height=1117&screen_width=1728&tz_name=Europe%2FBucharest&webcast_language=en&msToken=G1lr_8nRB3udnK_fFzgBD7sxvc0PK6Osokd1IJMaVPVcoB4mwSW-D6MQjTdoJ2o20PLt_MWNgtsAr095wVSShdmn_XVFS34bURvakVglDyWAHncoV_jVJCRdiJRdbJBi_E_KD_G8vpFF9-aOaJrk&X-Bogus=DFSzswVYWdxANGP5CtmFF2lUrn/4&_signature=_02B4Z6wo00001tPwkyAAAIDBIzv5q2eTgMbT8JeAANLu81",

  // Default request parameters
  DEFAULT_PARAMS: {
    count: 20,
    cursor: 0,
    device_id: '7525351986981094934',
  }
};

class VideoCommentsAPI {
  constructor(videoId = CONFIG.VIDEO_ID, msToken = CONFIG.MSTOKEN) {
    this.videoId = videoId;
    this.msToken = msToken;
    this.signer = null;
    this.permanentParams = null;
    this.videoInfo = null;
  }

  async initialize() {
    console.log("🚀 Initializing TikTok Video Comments API");
    console.log("📱 Video ID:", this.videoId);
    console.log("🔑 MS Token:", this.msToken.substring(0, 20) + "...");
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
      aweme_id: this.videoId,
      msToken: this.msToken,
      ...customParams
    };

    const queryString = new URLSearchParams(mergedParams).toString();
    const unsignedUrl = `https://www.tiktok.com/api/comment/list/?${queryString}`;

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

  async fetchComments(options = {}) {
    const {
      count = CONFIG.DEFAULT_PARAMS.count,
      cursor = CONFIG.DEFAULT_PARAMS.cursor,
      sortType = 0, // 0: time, 1: likes
      includeReplies = false
    } = options;

    try {
      console.log(`💬 Fetching comments for video: ${this.videoId}`);
      console.log(`📊 Requesting ${count} comments starting from cursor ${cursor}`);

      if (sortType === 1) {
        console.log("📈 Sorting by likes (popular first)");
      } else {
        console.log("🕒 Sorting by time (newest first)");
      }

      const customParams = {
        count,
        cursor
      };

      if (sortType !== 0) {
        customParams.sort_type = sortType;
      }

      const { xTtParams, signedUrl, userAgent } = await this.getSignature(customParams);

      console.log("🔑 X-TT-Params generated:", xTtParams.substring(0, 30) + "...");
      console.log("🔗 Signed URL generated:", signedUrl.substring(0, 100) + "...");
      console.log("🌐 Browser User Agent:", userAgent.substring(0, 50) + "...");

      console.log("📡 Making API request with signed URL...");
      const response = await this.makeRequest(userAgent, xTtParams, signedUrl);

      console.log("✅ API response received successfully");

      // Extract video info if available
      this.extractVideoInfo(response.data);

      // Fetch replies for top comments if requested
      if (includeReplies && response.data.comments) {
        await this.fetchRepliesForComments(response.data.comments.slice(0, 3));
      }

      return response.data;

    } catch (error) {
      console.error("❌ Error fetching video comments:", error.message);

      // Enhanced error handling
      if (error.response) {
        console.error("📱 Response status:", error.response.status);

        if (error.response.status === 404) {
          console.error("📱 Video not found - check video ID");
        } else if (error.response.status === 403) {
          console.error("🚫 Access forbidden - video may be private or restricted");
        } else if (error.response.status === 429) {
          console.error("⏰ Rate limited - try again later");
        }

        if (error.response.data) {
          console.error("📄 Response data:", error.response.data);
        }
      }

      throw error;
    }
  }

  extractVideoInfo(data) {
    // Try to extract video information from response
    if (data.extra && data.extra.logid) {
      console.log("🔍 Request ID:", data.extra.logid);
    }

    if (data.status_code !== undefined) {
      console.log("📊 Status Code:", data.status_code);
    }

    if (data.status_msg) {
      console.log("📄 Status Message:", data.status_msg);
    }
  }

  generateVideoReferer() {
    // Generate the specific video referer URL that's required for comments
    return `https://www.tiktok.com/@user/video/${this.videoId}`;
  }

  async makeRequest(userAgent, xTtParams, signedUrl) {
    const videoReferer = this.generateVideoReferer();

    const options = {
      method: "GET",
      url: signedUrl,
      headers: {
        "user-agent": userAgent,
        "x-tt-params": xTtParams,
        "referer": videoReferer, // CRITICAL: Video-specific referer required
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

    console.log("🔗 Using referer:", videoReferer);

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
    console.log("\n📊 Comments Results:");

    if (data.comments && data.comments.length > 0) {
      console.log(`💬 Found ${data.comments.length} comments`);

      if (data.has_more !== undefined) {
        console.log(`📄 Has more comments: ${data.has_more ? 'Yes' : 'No'}`);
      }

      if (data.cursor) {
        console.log(`🔄 Next cursor: ${data.cursor}`);
      }

      if (data.total !== undefined) {
        console.log(`📊 Total comments: ${data.total.toLocaleString()}`);
      }

      // Display comment details
      console.log("\n💬 Comment Details:");
      data.comments.forEach((comment, index) => {
        console.log(`\n${index + 1}. @${comment.user?.unique_id || comment.user?.uniqueId || 'unknown'}`);

        if (comment.user?.nickname || comment.user?.nick_name) {
          console.log(`   ✨ Display Name: ${comment.user.nickname || comment.user.nick_name}`);
        }

        console.log(`   💬 Comment: ${comment.text || 'No text'}`);

        // Comment stats
        console.log(`   👍 Likes: ${(comment.digg_count || comment.diggCount || 0).toLocaleString()}`);

        if (comment.reply_comment_total || comment.replyCommentTotal) {
          console.log(`   💭 Replies: ${(comment.reply_comment_total || comment.replyCommentTotal).toLocaleString()}`);
        }

        // Comment timestamp
        if (comment.create_time || comment.createTime) {
          const timestamp = comment.create_time || comment.createTime;
          console.log(`   📅 Posted: ${new Date(timestamp * 1000).toLocaleString()}`);
        }

        // Comment ID
        if (comment.cid) {
          console.log(`   🆔 Comment ID: ${comment.cid}`);
        }

        // User verification status
        if (comment.user?.verified) {
          console.log(`   ✅ Verified User: Yes`);
        }

        // Show if comment is pinned
        if (comment.is_pinned) {
          console.log(`   📌 Pinned: Yes`);
        }

        // Show if comment is from video author
        if (comment.is_author_digged) {
          console.log(`   ❤️ Liked by Author: Yes`);
        }
      });

    } else {
      console.log("📭 No comments found for this video");

      if (data.status_code !== undefined && data.status_code !== 0) {
        console.log(`⚠️ API returned status code: ${data.status_code}`);
      }

      if (data.status_msg) {
        console.log(`📄 Status message: ${data.status_msg}`);
      }
    }
  }

  // Method to fetch replies for specific comments
  async fetchRepliesForComments(comments) {
    console.log(`\n💭 Fetching replies for ${comments.length} comments...`);

    for (const comment of comments) {
      if ((comment.reply_comment_total || comment.replyCommentTotal) > 0) {
        try {
          const replies = await this.fetchCommentReplies(comment.cid);
          console.log(`   Comment ${comment.cid}: ${replies.length} replies fetched`);
        } catch (error) {
          console.log(`   Comment ${comment.cid}: Failed to fetch replies - ${error.message}`);
        }
      }
    }
  }

  // Method to fetch replies for a specific comment
  async fetchCommentReplies(commentId, count = 10) {
    try {
      const customParams = {
        comment_id: commentId,
        count: count,
        cursor: 0
      };

      // Use a different endpoint for replies
      const { xTtParams, userAgent } = await this.getSignature(customParams);

      const replyUrl = `https://www.tiktok.com/api/comment/list/reply/?${new URLSearchParams({
        ...this.permanentParams,
        ...customParams,
        aweme_id: this.videoId,
        msToken: this.msToken
      }).toString()}`;

      const response = await axios({
        method: "GET",
        url: replyUrl,
        headers: {
          "user-agent": userAgent,
          "x-tt-params": xTtParams,
          "referer": this.generateVideoReferer(),
          "accept": "application/json, text/plain, */*"
        }
      });

      return response.data.comments || [];

    } catch (error) {
      console.error(`❌ Error fetching replies for comment ${commentId}:`, error.message);
      return [];
    }
  }

  // Method to fetch comments in batches
  async fetchAllComments(maxComments = 100) {
    console.log(`📚 Fetching up to ${maxComments} comments in batches...`);

    let cursor = 0;
    let allComments = [];
    let hasMore = true;
    const batchSize = 20;

    while (hasMore && allComments.length < maxComments) {
      const remainingCount = Math.min(batchSize, maxComments - allComments.length);

      console.log(`\n📄 Fetching batch (cursor: ${cursor}, count: ${remainingCount})...`);

      const data = await this.fetchComments({
        count: remainingCount,
        cursor: cursor
      });

      if (data.comments && data.comments.length > 0) {
        allComments.push(...data.comments);
        console.log(`✅ Batch: ${data.comments.length} comments fetched (total: ${allComments.length})`);

        hasMore = data.has_more;
        cursor = data.cursor || (cursor + data.comments.length);
      } else {
        hasMore = false;
      }
    }

    console.log(`\n🎯 Total comments collected: ${allComments.length}`);
    return {
      comments: allComments,
      total: allComments.length,
      hasMore: hasMore
    };
  }

  // Method to analyze comment sentiment (basic)
  analyzeComments(comments) {
    console.log("\n📈 Comment Analysis:");

    const positiveWords = ['love', 'amazing', 'great', 'awesome', 'good', 'nice', 'beautiful', '❤️', '😍', '🔥'];
    const negativeWords = ['hate', 'bad', 'terrible', 'awful', 'worst', 'ugly', 'stupid', '😢', '😭', '😡'];

    let positive = 0;
    let negative = 0;
    let neutral = 0;

    comments.forEach(comment => {
      const text = (comment.text || '').toLowerCase();
      const hasPositive = positiveWords.some(word => text.includes(word));
      const hasNegative = negativeWords.some(word => text.includes(word));

      if (hasPositive && !hasNegative) positive++;
      else if (hasNegative && !hasPositive) negative++;
      else neutral++;
    });

    console.log(`   😊 Positive: ${positive} (${((positive / comments.length) * 100).toFixed(1)}%)`);
    console.log(`   😐 Neutral: ${neutral} (${((neutral / comments.length) * 100).toFixed(1)}%)`);
    console.log(`   😞 Negative: ${negative} (${((negative / comments.length) * 100).toFixed(1)}%)`);

    return { positive, neutral, negative };
  }
}

// Main execution function
async function main(videoId, options = {}) {
  const api = new VideoCommentsAPI(videoId, options.msToken || CONFIG.MSTOKEN);

  try {
    await api.initialize();

    if (options.fetchAll) {
      const data = await api.fetchAllComments(options.maxComments);
      api.displayResults(data);

      if (options.analyze) {
        api.analyzeComments(data.comments);
      }

      return data;
    } else {
      const data = await api.fetchComments(options);
      api.displayResults(data);

      if (options.analyze && data.comments) {
        api.analyzeComments(data.comments);
      }

      return data;
    }
  } catch (error) {
    console.error("❌ Failed to fetch video comments:", error.message);
    throw error;
  } finally {
    await api.cleanup();
  }
}

// Export for module usage
export default main;
export { VideoCommentsAPI };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const videoId = process.argv[2] || CONFIG.VIDEO_ID;
  const fetchAll = process.argv.includes('--all');
  const analyze = process.argv.includes('--analyze');
  const includeReplies = process.argv.includes('--replies');
  const count = parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1]) || 20;
  const maxComments = parseInt(process.argv.find(arg => arg.startsWith('--max='))?.split('=')[1]) || 100;

  main(videoId, { fetchAll, analyze, includeReplies, count, maxComments })
    .then(() => {
      console.log("\n✅ Comments example completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Example failed:", error.message);
      process.exit(1);
    });
}