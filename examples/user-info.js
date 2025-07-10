import Signer from "../index.js";
import axios from "axios"; // NOTE: not adding this to package.json, you'll need to install it manually
import querystring from "querystring";

// The `username` of your TikTok profile.
const USER_UNIQUE_ID = "tiktok";

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  "https://www.tiktok.com/api/user/detail/?WebIdLastTime=1752132549&abTestVersion=%5Bobject%20Object%5D&aid=1988&appType=m&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F138.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=false&device_id=7525351986981094934&device_platform=web_pc&focus_state=true&from_page=user&history_len=3&is_fullscreen=false&is_page_visible=true&language=en&locateItemID=7195062981313580293&needAudienceControl=true&odinId=7525351908476732438&os=mac&priority_region=&referer=&region=RO&screen_height=1117&screen_width=1728&secUid=&tz_name=Europe%2FBucharest&uniqueId=realestkyiv&user_is_login=false&webcast_language=en&msToken=U8MGxbgdE4RkU4lVFBJxBvVhyRxZ5hMru4gX1ec7MwqMZeD981yMgSagMxZLexXLMyrCeIzw5yAFHvUpy72rUFzggoxGivTarQfgwD7Rh68DGiYBywshxH1CSwPTM_cvXpH_c6as5eLBD_tXLFppAikM&X-Bogus=DFSzswVYWdxANGP5CtmFF2lUrn/4&X-Gnarly=MKFGyWhSW6LFl8QBds0j667bFRY2n013Z4wG0kwE7E3oYWtgi7nbxDqpGxYuFBfal-FTlPQrY2eTSNHZb2e0boW5rh8--UNsg531QFkaf5xNnm21JDKkB7LZSpUCk7wi7kn1fMNryzNqL4y9dr1mIrmGw6hl3vLGIUrlZH4/XEXbGcQDbAsRU2GxP2HAYbrSu98vJNKV7gEE/aS94ZGvhZUNxm6H9n87ObMJl4PGoRpx6xtXG/9CihUH8zKwXdnNZNKoCrNkYCYIkvOOfzJ3TPqIUov6VWRuDyP4oYrbyPlF";

// If you're getting empty results change the verifyFp, msToken, X-Bogus and _signature params

// Parse the URL
const parsedUrl = new URL(TT_REQ_PERM_URL);

// Extract the query parameters
const parsedQuery = querystring.parse(parsedUrl.search.slice(1));

const PARAMS = {
  count: 30,
  device_id: '7236846595559933400',
  secUid: "",
  uniqueId: USER_UNIQUE_ID,
  cursor: 0,
};
// Merge parsedQuery with PARAMS
const mergedParams = { ...parsedQuery, ...PARAMS };


async function main() {
  console.log("🚀 Starting TikTok User Info API example");
  console.log("👤 User Unique ID:", USER_UNIQUE_ID);
  
  const signer = new Signer(null, USER_AGENT);
  console.log("🌐 User Agent:", USER_AGENT);
  
  console.log("⏳ Initializing signer...");
  await signer.init();
  console.log("✅ Signer initialized");

  const qsObject = new URLSearchParams(mergedParams);
  const qs = qsObject.toString();
  console.log("📝 Query string:", qs.substring(0, 100) + "...");

  const unsignedUrl = `https://www.tiktok.com/api/user/detail?${qs}`;
  console.log("🔗 Unsigned URL:", unsignedUrl.substring(0, 100) + "...");

  console.log("✍️ Signing URL...");
  const signature = await signer.sign(unsignedUrl);
  console.log("📋 Signature:", signature.signature.substring(0, 20) + "...");
  
  const navigator = await signer.navigator();
  console.log("🧭 Navigator data collected");
  
  console.log("🔒 Closing signer...");
  await signer.close();

  const { "x-tt-params": xTtParams, signed_url } = signature;
  const { user_agent: userAgent } = navigator;
  console.log("🔑 X-TT-Params:", xTtParams.substring(0, 20) + "...");
  console.log("🌐 Final signed URL:", signed_url.substring(0, 100) + "...");

  console.log("📡 Making API request...");
  const res = await testApiReq({ userAgent, xTtParams, signed_url });
  const { data } = res;
  console.log("✅ API Response received");
  console.log("📊 Data:", data);
}

async function testApiReq({ userAgent, xTtParams, signed_url }) {
  const options = {
    method: "GET",
    headers: {
      "user-agent": userAgent,
      "x-tt-params": xTtParams,
    },
    url: signed_url,
  };
  return axios(options);
}

main();
