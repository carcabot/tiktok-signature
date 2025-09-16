import axios, { AxiosResponse } from 'axios';

// Type definitions
interface SignatureResponse {
  status: string;
  data: {
    signature: string;
    verify_fp: string;
    signed_url: string;
    'x-tt-params': string;
    'x-bogus': string;
    navigator: {
      deviceScaleFactor: number;
      user_agent: string;
      browser_language: string;
      browser_platform: string;
      browser_name: string;
      browser_version: string;
    };
  };
  metadata: {
    processingTime: number;
    timestamp: string;
  };
}

interface HealthResponse {
  status: string;
  uptime: number;
  requestCount: number;
  timestamp: string;
}

interface TikTokApiResponse {
  status_code: number;
  status_msg: string;
  [key: string]: any;
}

interface TikTokClientConfig {
  signatureServerUrl?: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
}

class TikTokClientTS {
  private signatureServerUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: TikTokClientConfig = {}) {
    this.signatureServerUrl = config.signatureServerUrl || 'http://localhost:8080';
    this.timeout = config.timeout || 30000;
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      ...config.defaultHeaders,
    };
  }

  async getSignature(url: string): Promise<SignatureResponse['data']> {
    try {
      console.log(`🔄 Requesting signature for: ${url.substring(0, 80)}...`);

      const response: AxiosResponse<SignatureResponse> = await axios.post(
        `${this.signatureServerUrl}/signature`,
        url,
        {
          headers: { 'Content-Type': 'text/plain' },
          timeout: this.timeout,
        }
      );

      if (response.data.status !== 'ok') {
        throw new Error(`Signature service error: ${response.data.status}`);
      }

      console.log(`✅ Signature obtained in ${response.data.metadata?.processingTime || 'N/A'}ms`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get signature:', (error as Error).message);
      throw error;
    }
  }

  async makeRequest<T = TikTokApiResponse>(
    endpoint: string,
    params: Record<string, any> = {},
    options: {
      headers?: Record<string, string>;
      method?: 'GET' | 'POST';
      referer?: string;
      timeout?: number;
    } = {}
  ): Promise<T> {
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

      const response: AxiosResponse<T> = await axios({
        method: options.method || 'GET',
        url: signatureData.signed_url,
        headers,
        timeout: options.timeout || 15000,
      });

      console.log(`✅ API request successful (${response.status})`);
      return response.data;
    } catch (error) {
      console.error('❌ API request failed:', (error as Error).message);
      throw error;
    }
  }

  async getUserInfo(secUid: string): Promise<TikTokApiResponse> {
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

  async getTrending(count: number = 30, cursor: number = 0): Promise<TikTokApiResponse> {
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

  async healthCheck(): Promise<HealthResponse> {
    try {
      const response: AxiosResponse<HealthResponse> = await axios.get(
        `${this.signatureServerUrl}/health`,
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Health check failed:', (error as Error).message);
      throw error;
    }
  }

  private generateDeviceId(): string {
    return Math.floor(Math.random() * 9000000000000000 + 1000000000000000).toString();
  }
}

// Example usage
async function runTypeScriptExample(): Promise<void> {
  console.log("🚀 Starting TikTok TypeScript API example");

  try {
    const client = new TikTokClientTS({
      signatureServerUrl: 'http://localhost:8080',
      timeout: 30000,
    });

    // Check health
    console.log("🏥 Checking signature server health...");
    const health = await client.healthCheck();
    console.log(`✅ Server is ${health.status}, uptime: ${health.uptime}s`);

    // Get trending videos
    console.log("🔥 Fetching trending videos...");
    const trending = await client.getTrending(5);

    if (trending.status_code === 0) {
      console.log("📊 Trending videos fetched successfully!");

      // Type assertion for demonstration
      const trendingData = trending as any;
      if (trendingData.itemList && trendingData.itemList.length > 0) {
        console.log(`\n🎥 Found ${trendingData.itemList.length} trending videos:`);
        trendingData.itemList.slice(0, 3).forEach((video: any, index: number) => {
          console.log(`${index + 1}. @${video.author?.uniqueId}: ${video.desc?.substring(0, 50)}...`);
        });
      }
    } else {
      console.log(`❌ API returned error: ${trending.status_msg}`);
    }

  } catch (error) {
    console.error("❌ TypeScript example failed:", (error as Error).message);
  }
}

// Export for use as module
export { TikTokClientTS };
export type { SignatureResponse, HealthResponse, TikTokApiResponse, TikTokClientConfig };

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTypeScriptExample()
    .then(() => {
      console.log("\n✅ TypeScript example completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ TypeScript example failed:", error.message);
      process.exit(1);
    });
}