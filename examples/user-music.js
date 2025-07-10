import Signer from "../index.js";
import axios from "axios"; // NOTE: not adding this to package.json, you'll need to install it manually

// Get your SEC_UID from https://t.tiktok.com/api/user/detail/?aid=1988&uniqueId=username&language=it
// where `username` is your TikTok username.
const musicID = "7034143722082192134";

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36 Edg/101.0.1210.53";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  "https://m.tiktok.com/api/music/item_list/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F101.0.4951.64%20Safari%2F537.36%20Edg%2F101.0.1210.53&channel=tiktok_web&cookie_enabled=true&device_id=7002566096994190854&device_platform=web_pc&focus_state=false&from_page=music&history_len=1&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=RO&referer=&region=RO&screen_height=1080&screen_width=1920&tz_name=Europe%2FBucharest&verifyFp=verify_dca8729afe5c502257ed30b0b070dbdb&webcast_language=en&msToken=K8Xf-t_4RZ5n27zHsUPRyDIjpHQtfPeuHSvtbWzz0D0CQkX1UEyEdV0Xgx5BdbFPqKZ2McVCdlo1RM_u3o9FRglKoFa7TLZz2Yhd_fYRgWKhQDAq1TxQwLSTCz7Jp-EzVhopdNFO&X-Bogus=DFSzswVOLbUANCTQSwQvy2XyYJAm&_signature=_02B4Z6wo00001S9DBBwAAIDADOIqsG3-iK0vQwCAAClJd0";

const PARAMS = {
  aid: 1988,
  count: 30,
  cursor: 0,
  musicID: musicID,
  secUid: "",
  cookie_enabled: true,
  screen_width: 0,
  screen_height: 0,
  browser_language: "",
  browser_platform: "",
  browser_name: "",
  browser_version: "",
  browser_online: "",
  timezone_name: "Europe/London",
};

async function main() {
  console.log("🚀 Starting TikTok User Music API example");
  console.log("🎵 Music ID:", musicID);
  
  const signer = new Signer(null, USER_AGENT);
  console.log("🌐 User Agent:", USER_AGENT);
  
  console.log("⏳ Initializing signer...");
  await signer.init();
  console.log("✅ Signer initialized");

  const qsObject = new URLSearchParams(PARAMS);
  const qs = qsObject.toString();
  console.log("📝 Query string:", qs.substring(0, 100) + "...");

  const unsignedUrl = `https://m.tiktok.com/api/music/item_list/?${qs}`;
  console.log("🔗 Unsigned URL:", unsignedUrl.substring(0, 100) + "...");
  
  console.log("✍️ Signing URL...");
  const signature = await signer.sign(unsignedUrl);
  console.log("📋 Signature:", signature.signature.substring(0, 20) + "...");
  
  const navigator = await signer.navigator();
  console.log("🧭 Navigator data collected");
  
  console.log("🔒 Closing signer...");
  await signer.close();

  // We don't take the `signed_url` from the response, we use the `x-tt-params` header instead because TikTok has
  // some weird security considerations. I'm not sure if it's a local encode or they actually make a call to their
  // servers to get the signature back, but your API call params are in the `x-tt-params` header, which is used
  // when making the request to the static URL `TT_REQ_PERM_URL` above. I'm assuming because the library launches
  // a headless browser, it's a local encode.
  const { "x-tt-params": xTtParams } = signature;
  const { user_agent: userAgent } = navigator;
  console.log("🔑 X-TT-Params:", xTtParams.substring(0, 20) + "...");
  console.log("🌐 Final User Agent:", userAgent);

  console.log("📡 Making API request to permanent URL...");
  const res = await testApiReq({ userAgent, xTtParams });
  const { data } = res;
  console.log("✅ API Response received");
  console.log("📊 Data:", data);
}

async function testApiReq({ userAgent, xTtParams }) {
  const options = {
    method: "GET",
    headers: {
      "user-agent": userAgent,
      "x-tt-params": xTtParams,
    },
    url: TT_REQ_PERM_URL,
  };
  return axios(options);
}

main();
