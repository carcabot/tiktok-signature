const Signer = require("../");
const axios = require("axios"); // NOTE: not adding this to package.json, you'll need to install it manually

// Get your SEC_UID from https://t.tiktok.com/api/user/detail/?aid=1988&uniqueId=username&language=it
// where `username` is your TikTok username.
const SEC_UID =
  "MS4wLjABAAAAQ09e6Ck9CQrQQYAPLehEKMlvVS8XzmGcbNHTGXsXIZSIj7Pe21eYtDq0nzKy6-5V";

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL

const PARAMS = {
  aid: "1988",
  count: 30,
  secUid: SEC_UID,
  cursor: 0,
  secUid: SEC_UID,
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
  const signer = new Signer(null, USER_AGENT);
  await signer.init();

  const qsObject = new URLSearchParams(PARAMS);
  const qs = qsObject.toString();

  const unsignedUrl = `https://www.tiktok.com/api/post/item_list/?${qs}`;
  const signature = await signer.sign(unsignedUrl);
  const navigator = await signer.navigator();
  await signer.close();

  const { "x-tt-params": xTtParams, signed_url } = signature;
  const { user_agent: userAgent } = navigator;

  const res = await testApiReq({ userAgent, xTtParams }, signed_url);
  const { data } = res;
  console.log(data);
}

async function testApiReq({ userAgent, xTtParams }, url) {
  const options = {
    method: "GET",
    headers: {
      "User-Agent": userAgent,
      "x-tt-params": xTtParams,
    },
    url: url,
  };
  return axios(options);
}

main();
