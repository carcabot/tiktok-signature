const Signer = require("..");
const axios = require("axios"); // NOTE: not adding this to package.json, you'll need to install it manually

// Get your SEC_UID from https://t.tiktok.com/api/user/detail/?aid=1988&uniqueId=username&language=it
// where `username` is your TikTok username.
const SEC_UID =
  "MS4wLjABAAAAQ09e6Ck9CQrQQYAPLehEKMlvVS8XzmGcbNHTGXsXIZSIj7Pe21eYtDq0nzKy6-5V";

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const TT_REQ_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  "https://www.tiktok.com/api/post/item_list/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F107.0.0.0%20Safari%2F537.36%20Edg%2F107.0.1418.35&channel=tiktok_web&cookie_enabled=true&device_id=7002566096994190854&device_platform=web_pc&focus_state=false&from_page=user&history_len=3&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=RO&referer=https%3A%2F%2Fexportcomments.com%2F&region=RO&root_referer=https%3A%2F%2Fexportcomments.com%2F&screen_height=1440&screen_width=2560&tz_name=Europe%2FBucharest&verifyFp=verify_lacphy8d_z2ux9idt_xdmu_4gKb_9nng_NNTTTvsFS8ao&webcast_language=en&msToken=7UfjxOYL5mVC8QFOKQRhmLR3pCjoxewuwxtfFIcPweqC05Q6C_qjW-5Ba6_fE5-fkZc0wkLSWaaesA4CZ0LAqRrXSL8b88jGvEjbZPwLIPnHeyQq6VifzyKf5oGCQNw_W4Xq12Q-8KCuyiKGLOw=&X-Bogus=DFSzswVL-XGANHVWS0OnS2XyYJUm&_signature=_02B4Z6wo00001Pf0DlwAAIDB1FUg8jgaqOz39ArAAF6Z72";

const PARAMS = {
  aid: "1988",
  count: 30,
  secUid: SEC_UID,
  cursor: 0,
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
  const signer = new Signer(null, TT_REQ_USER_AGENT);
  await signer.init();

  const qsObject = new URLSearchParams(PARAMS);
  const qs = qsObject.toString();

  const unsignedUrl = `https://m.tiktok.com/api/post/item_list/?${qs}`;
  const signature = await signer.sign(unsignedUrl);
  const navigator = await signer.navigator();
  await signer.close();

  // We don't take the `signed_url` from the response, we use the `x-tt-params` header instead because TikTok has
  // some weird security considerations. I'm not sure if it's a local encode or they actually make a call to their
  // servers to get the signature back, but your API call params are in the `x-tt-params` header, which is used
  // when making the request to the static URL `TT_REQ_PERM_URL` above. I'm assuming because the library launches
  // a headless browser, it's a local encode.
  const { "x-tt-params": xTtParams } = signature;
  const { user_agent: userAgent } = navigator;

  const res = await testApiReq({ userAgent, xTtParams });
  const { data } = res;
  console.log(data);
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
