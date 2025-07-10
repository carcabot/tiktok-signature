import Signer from "../index.js";
import axios from "axios"; // NOTE: not adding this to package.json, you'll need to install it manually
import querystring from "querystring";

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const VIDEO_ID = "7517698113180617989";

const MSTOKEN = "G1lr_8nRB3udnK_fFzgBD7sxvc0PK6Osokd1IJMaVPVcoB4mwSW-D6MQjTdoJ2o20PLt_MWNgtsAr095wVSShdmn_XVFS34bURvakVglDyWAHncoV_jVJCRdiJRdbJBi_E_KD_G8vpFF9-aOaJrk";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  "https://www.tiktok.com/api/comment/list/?WebIdLastTime=1752132549&aid=1988&app_language=en&app_name=tiktok_web&aweme_id=7206067410766433541&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F138.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&count=20&cursor=0&current_region=US&device_id=7525351986981094934&device_platform=web_pc&focus_state=true&from_page=video&history_len=3&is_fullscreen=false&is_page_visible=true&language=en&os=mac&priority_region=US&referer=&region=US&screen_height=1117&screen_width=1728&tz_name=Europe%2FBucharest&webcast_language=en&msToken=G1lr_8nRB3udnK_fFzgBD7sxvc0PK6Osokd1IJMaVPVcoB4mwSW-D6MQjTdoJ2o20PLt_MWNgtsAr095wVSShdmn_XVFS34bURvakVglDyWAHncoV_jVJCRdiJRdbJBi_E_KD_G8vpFF9-aOaJrk&X-Bogus=DFSzswVYWdxANGP5CtmFF2lUrn/4&_signature=_02B4Z6wo00001tPwkyAAAIDBIzv5q2eTgMbT8JeAANLu81";

// Parse the URL
const parsedUrl = new URL(TT_REQ_PERM_URL);

// Extract the query parameters
const parsedQuery = querystring.parse(parsedUrl.search.slice(1));


const PARAMS = {
  aweme_id: VIDEO_ID,
  cursor: 0,
  count: 20,
  msToken: MSTOKEN, // msToken is required for comments
  device_id: '7525351986981094934',
};

// Merge parsedQuery with PARAMS
const mergedParams = { ...parsedQuery, ...PARAMS };

async function main() {
  console.log("🚀 Starting TikTok Comments API example");
  console.log("📱 Video ID:", VIDEO_ID);
  console.log("🔑 MS Token:", MSTOKEN.substring(0, 20) + "...");

  const signer = new Signer(null, USER_AGENT);
  console.log("🌐 User Agent:", USER_AGENT);

  console.log("⏳ Initializing signer...");
  await signer.init();
  console.log("✅ Signer initialized");

  const qsObject = new URLSearchParams(mergedParams);
  const qs = qsObject.toString();
  console.log("📝 Query string:", qs.substring(0, 100) + "...");

  const unsignedUrl = `https://www.tiktok.com/api/comment/list/?${qs}`;
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
  console.log("🌐 Using permanent URL for API request");

  console.log("📡 Making API request to permanent URL...");
  console.log("🔗 Final signed URL:", signed_url);
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
      "referer": "https://www.tiktok.com/@haosmosromania/video/7206067410766433541" // !!! Referer is required
    },
    url: signed_url,
  };
  return axios(options);
}

main();
