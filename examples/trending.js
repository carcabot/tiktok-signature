import Signer from "../index.js";
import axios from "axios"; // NOTE: not adding this to package.json, you'll need to install it manually

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.53";


// If you're getting empty results change the verifyFp, msToken, X-Bogus and _signature params
const queryParams = {
  aid: "1988",
  app_language: "en",
  app_name: "tiktok_web",
  battery_info: "1"
};

async function main() {
  console.log("🚀 Starting TikTok Trending API example");
  console.log("🔥 Fetching trending content...");
  
  const signer = new Signer(null, USER_AGENT);
  console.log("🌐 User Agent:", USER_AGENT);
  
  console.log("⏳ Initializing signer...");
  await signer.init();
  console.log("✅ Signer initialized");

  const qsObject = new URLSearchParams(queryParams);
  const qs = qsObject.toString();
  console.log("📝 Query string:", qs);

  const unsignedUrl = `https://www.tiktok.com/node/share/discover?${qs}`;
  console.log("🔗 Unsigned URL:", unsignedUrl);

  console.log("✍️ Signing URL...");
  const signature = await signer.sign(unsignedUrl);
  console.log("📋 Signature:", signature.signature.substring(0, 20) + "...");
  
  const navigator = await signer.navigator();
  console.log("🧭 Navigator data collected");
  
  console.log("🔒 Closing signer...");
  await signer.close();

  const { signed_url } = signature;
  const { user_agent: userAgent } = navigator;
  console.log("🌐 Final signed URL:", signed_url.substring(0, 100) + "...");
  
  console.log("📡 Making API request...");
  const res = await testApiReq({ userAgent }, signed_url);
  const { data } = res;
  console.log("✅ API Response received");
  console.log("📊 Data:", data);
}

async function testApiReq({ userAgent }, url) {
  const options = {
    method: "GET",
    headers: {
      "user-agent": userAgent
    },
    url: url,
  };
  return axios(options);
}

main();
