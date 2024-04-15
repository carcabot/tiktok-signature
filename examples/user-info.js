const Signer = require("../");
const axios = require("axios"); // NOTE: not adding this to package.json, you'll need to install it manually
const querystring = require('querystring');

// The `username` of your TikTok profile.
const USER_UNIQUE_ID = "tiktok";

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.53";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  "https://www.tiktok.com/api/user/detail/?WebIdLastTime=1684959661&abTestVersion=%5Bobject%20Object%5D&aid=1988&appType=m&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F123.0.0.0%20Safari%2F537.36%20Edg%2F123.0.0.0&channel=tiktok_web&cookie_enabled=true&device_id=7236846595559933400&device_platform=web_pc&focus_state=true&from_page=user&history_len=8&is_fullscreen=false&is_page_visible=true&language=en&os=windows&priority_region=RO&referer=https%3A%2F%2Fwww.tiktok.com%2Fbusiness-suite%2Fmessages%3Ffrom%3Dhomepage%26lang%3Den&region=RO&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fbusiness-suite%2Fmessages%3Ffrom%3Dhomepage%26lang%3Den&screen_height=1080&screen_width=1920&secUid=&tz_name=Europe%2FBucharest&uniqueId=&user=%5Bobject%20Object%5D&verifyFp=verify_lv1bd0o8_AA3QC5jZ_70uk_4haw_BYSy_P6oIpsr0LMUE&webcast_language=en&msToken=gGkV_K79_CgoknlGzARe-cvv4ZSaZef9sjd_u6jSxLNHchbi_ZF9hPG_35EoQcHxHDAJkb4dDW9gec1CKXWV3ELFQ6bVUUSQBsj1Vfi_feLstK-6SHMxJMVc-Zvm6xA9AMUG&X-Bogus=DFSzswVue6zANHsMt5bgO74m8icv&_signature=_02B4Z6wo00001Xk8yMwAAIDCifeiRAutXwV5PMxAADhW65";

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
  const signer = new Signer(null, USER_AGENT);
  await signer.init();

  const qsObject = new URLSearchParams(mergedParams);
  const qs = qsObject.toString();

  const unsignedUrl = `https://www.tiktok.com/api/user/detail?${qs}`;

  const signature = await signer.sign(unsignedUrl);
  const navigator = await signer.navigator();
  await signer.close();


  const { "x-tt-params": xTtParams, signed_url } = signature;
  const { user_agent: userAgent } = navigator;

  const res = await testApiReq({ userAgent, xTtParams, signed_url });
  const { data } = res;
  console.log(data);
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
