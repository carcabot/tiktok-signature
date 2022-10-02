const Signer = require("../");
const axios = require("axios"); // NOTE: not adding this to package.json, you'll need to install it manually

// The `username` of your TikTok profile.
const USER_UNIQUE_ID = "tiktok";

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.53";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  "https://www.tiktok.com/api/user/detail/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F105.0.0.0%20Safari%2F537.36%20Edg%2F105.0.1343.53&channel=tiktok_web&cookie_enabled=true&device_id=7149974697697428997&device_platform=web_pc&focus_state=true&from_page=user&history_len=3&is_fullscreen=false&is_page_visible=true&language=en&os=windows&priority_region=&referer=&region=RO&screen_height=1440&screen_width=2560&secUid=&tz_name=Europe%2FBucharest&uniqueId=emmax_jnr&webcast_language=en&msToken=byMTrhcGuu6WHrJslbbA1f-QJKLaiUiTZhGBvn1i43c1MzTB192fsxadbUpRs4vZp2Zsvjg2DYODyEZr8jFV6etAdBoBG8-MnqhcH7pyE9DL8s42m2I-SYVPYZiVakOchCol2UGPQW1QiBYdOQ==&X-Bogus=DFSzswVYmHtANH7ZSKy6IGXyYJU3&_signature=_02B4Z6wo00001kU0aZwAAIDDZpVHMLhlGFZFNG0AAPKD0f";

// If you're getting empty results change the verifyFp, msToken, X-Bogus and _signature params
const queryParams = {
  aid: "1988",
  app_language: "en",
  app_name: "tiktok_web",
  battery_info: "1",
  browser_language: "en-US",
  browser_name: "Mozilla",
  browser_online: "true",
  browser_platform: "Win32",
  browser_version:
    "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.53",
  channel: "tiktok_web",
  cookie_enabled: "true",
  device_platform: "web_pc",
  focus_state: "true",
  from_page: "user",
  history_len: "3",
  is_fullscreen: "false",
  is_page_visible: "true",
  language: "en",
  os: "windows",
  priority_region: "",
  referer: "",
  region: "US",
  screen_height: "1440",
  screen_width: "2560",
  secUid: "",
  uniqueId: USER_UNIQUE_ID,
  webcast_language: "en",
};

async function main() {
  const signer = new Signer(null, USER_AGENT);
  await signer.init();

  const qsObject = new URLSearchParams(queryParams);
  const qs = qsObject.toString();

  const unsignedUrl = `https://www.tiktok.com/api/user/detail?${qs}`;

  const signature = await signer.sign(unsignedUrl);
  const navigator = await signer.navigator();
  await signer.close();

  // We don't take the `signed_url` from the response, we use the `x-tt-params` header instead because TikTok has
  // some weird security considerations. I'm not sure if it's a local encode or they actually make a call to their
  // servers to get the signature back, but your API call params are in the `x-tt-params` header, which is used
  // when making the request to the static URL `TT_REQ_PERM_URL` above. I'm assuming because the library launches
  // a headless browser, it's a local encode.
  const { "x-tt-params": xTtParams, signed_url } = signature;
  const { user_agent: userAgent } = navigator;
  const res = await testApiReq({ userAgent, xTtParams }, TT_REQ_PERM_URL);
  const { data } = res;
  console.log(data);
}

async function testApiReq({ userAgent, xTtParams }, url) {
  const options = {
    method: "GET",
    headers: {
      "user-agent": userAgent,
      "x-tt-params": xTtParams,
    },
    url: url,
  };
  return axios(options);
}

main();
