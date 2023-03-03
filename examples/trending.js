const Signer = require("../");
const axios = require("axios"); // NOTE: not adding this to package.json, you'll need to install it manually

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
  const signer = new Signer(null, USER_AGENT);
  await signer.init();

  const qsObject = new URLSearchParams(queryParams);
  const qs = qsObject.toString();

  const unsignedUrl = `https://www.tiktok.com/node/share/discover?${qs}`;

  const signature = await signer.sign(unsignedUrl);
  const navigator = await signer.navigator();
  await signer.close();

  const { signed_url } = signature;
  const { user_agent: userAgent } = navigator;
  const res = await testApiReq({ userAgent }, signed_url);
  const { data } = res;
  console.log(data);
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
