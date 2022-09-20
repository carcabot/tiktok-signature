const Signer = require('../');
const axios = require('../node_modules/axios'); // NOTE: not adding this to package.json, you'll need to install it manually

// The `username` of your TikTok profile.
const USER_UNIQUE_ID = 'tiktok';
  
// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36';

const PARAMS = {
  aid: "1988",
}
// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
    `https://www.tiktok.com/node/share/user/@${USER_UNIQUE_ID}/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F104.0.5112.81%20Safari%2F537.36%20Edg%2F104.0.1293.54&channel=tiktok_web&cookie_enabled=true&device_id=7132764148269827589&device_platform=web_pc&focus_state=false&from_page=user&history_len=2&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=&referer=&region=RO&screen_height=1080&screen_width=1920&tz_name=Europe%2FBucharest&verifyFp=verify_l6xh4etd_sOgxjaYJ_yA8A_443j_Abzf_DXcCohMuHsiY&webcast_language=en&msToken=2-YQoDnPcbE-S2LNBdPKY3yFLevlAyymGgmpUV2pTw9wPx8zNenbM3_k6qzpij2fP4lLX60PUD3ioBDLcwtha9ezlAxXIMx4Nf97fTnECSgDJp33R8z9o-JHTrX3rVMGDdOUU8Y=&X-Bogus=DFSzswjEwV0AN9xsS6EXkGXyYJW1&_signature=_02B4Z6wo00001CDFs.AAAIDBA2SdXY0j46Agxb9AAGrU3c`;

async function main() {
  const signer = new Signer(null, USER_AGENT);
  await signer.init();

  const qsObject = new URLSearchParams(PARAMS);
  const qs = qsObject.toString();

  const unsignedUrl = `https://www.tiktok.com/node/share/user/@${USER_UNIQUE_ID}?${qs}`;
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
    method: 'GET',
    headers: {
      'user-agent': userAgent,
      'x-tt-params': xTtParams,
    },
    url: TT_REQ_PERM_URL,
  };
  return axios(options);
}

main();
