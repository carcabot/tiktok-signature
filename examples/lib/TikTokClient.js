import axios from 'axios';

export class TikTokClient {
  constructor(signatureServerUrl = 'http://localhost:8080') {
    this.signatureServerUrl = signatureServerUrl;
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
  }

  async getSignature(url) {
    try {
      console.log(`🔄 Requesting signature for: ${url.substring(0, 80)}...`);

      const response = await axios.post(`${this.signatureServerUrl}/signature`, url, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 30000,
      });
      if (response.data.status !== 'ok') {
        throw new Error(`Signature service error: ${response.data.error?.message || 'Unknown error'}`);
      }

      console.log(`✅ Signature obtained in ${response.data.metadata?.processingTime || 'N/A'}ms`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get signature:', error.message);
      throw error;
    }
  }

  async makeRequest(endpoint, params = {}, options = {}) {
    try {
      const queryParams = new URLSearchParams(params);
      const unsignedUrl = `${endpoint}?${queryParams.toString()}`;

      console.log(`📡 Making TikTok API request to: ${endpoint}`);

      const signatureData = await this.getSignature(unsignedUrl);

      const headers = {
        ...this.defaultHeaders,
        'User-Agent': signatureData.navigator.user_agent,
        'X-TT-Params': signatureData['x-tt-params'],
        ...options.headers,
      };

      if (options.referer) {
        headers['Referer'] = options.referer;
      }

      const response = await axios({
        method: options.method || 'GET',
        url: signatureData.signed_url,
        headers,
        timeout: options.timeout || 15000,
        ...options.axiosConfig,
      });

      console.log(`✅ API request successful (${response.status})`);
      return response.data;
    } catch (error) {
      console.error('❌ API request failed:', error.message);
      throw error;
    }
  }

  // Specific API methods
  async getUserInfo(secUid) {
    const params = {
      aid: 1988,
      secUid,
      language: 'en',
      region: 'US',
      app_language: 'en',
      device_platform: 'web_pc',
    };

    return this.makeRequest('https://www.tiktok.com/api/user/detail/', params);
  }

  async getUserVideos(secUid, count = 30, cursor = 0) {
    const params = {
      aid: 1988,
      secUid,
      count,
      cursor,
      type: 1,
      language: 'en',
      region: 'US',
      app_language: 'en',
      device_platform: 'web_pc',
    };

    return this.makeRequest('https://www.tiktok.com/api/post/item_list/', params);
  }

  async getComments(awemeId, count = 20, cursor = 0, msToken) {
    const params = {
      aid: 1988,
      aweme_id: awemeId,
      count,
      cursor,
      msToken,
      language: 'en',
      region: 'US',
      app_language: 'en',
      device_platform: 'web_pc',
      WebIdLastTime: Math.floor(Date.now() / 1000),
      device_id: this.generateDeviceId(),
    };

    const referer = `https://www.tiktok.com/@user/video/${awemeId}`;

    return this.makeRequest('https://www.tiktok.com/api/comment/list/', params, {
      referer,
    });
  }

  async getTrending(count = 30, cursor = 0) {
    const params = {
      aid: 1988,
      count,
      cursor,
      language: 'en',
      region: 'US',
      app_language: 'en',
      device_platform: 'web_pc',
    };

    return this.makeRequest('https://www.tiktok.com/api/recommend/item_list/', params);
  }

  async getHashtagVideos(challengeId, count = 30, cursor = 0) {
    const params = {
      aid: 1988,
      challengeID: challengeId,
      count,
      cursor,
      language: 'en',
      region: 'US',
      app_language: 'en',
      device_platform: 'web_pc',
    };

    return this.makeRequest('https://www.tiktok.com/api/challenge/item_list/', params);
  }

  async getUserMusic(secUid, count = 30, cursor = 0) {
    const params = {
      aid: 1988,
      secUid,
      count,
      cursor,
      type: 2, // Type 2 for music
      language: 'en',
      region: 'US',
      app_language: 'en',
      device_platform: 'web_pc',
    };

    return this.makeRequest('https://www.tiktok.com/api/music/item_list/', params);
  }

  generateDeviceId() {
    // Generate a device ID safely within JavaScript's safe integer range
    return Math.floor(Math.random() * 9000000000000000) + 1000000000000000;
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.signatureServerUrl}/health`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      throw error;
    }
  }
}

export default TikTokClient;