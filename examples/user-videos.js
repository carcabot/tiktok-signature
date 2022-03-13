const Signer = require('../');
const axios = require('axios'); // NOTE: not adding this to package.json, you'll need to install it manually

// Get your SEC_UID from https://t.tiktok.com/api/user/detail/?aid=1988&uniqueId=username&language=it
// where `username` is your TikTok username.
const SEC_UID =
  'MS4wLjABAAAAQ09e6Ck9CQrQQYAPLehEKMlvVS8XzmGcbNHTGXsXIZSIj7Pe21eYtDq0nzKy6-5V';

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36';

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  'https://m.tiktok.com/api/post/item_list/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F98.0.4758.102%20Safari%2F537.36%20Edg%2F98.0.1108.62&channel=tiktok_web&cookie_enabled=true&device_id=7002566096994190854&device_platform=web_pc&focus_state=true&from_page=user&history_len=2&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=RO&referer=&region=RO&root_referer&screen_height=1080&screen_width=1920&tz_name=Europe%2FBucharest&verifyFp=verify_dca8729afe5c502257ed30b0b070dbdb&webcast_language=en&msToken=ke4xktLgsxyAhsw7mGoAII-6L3--7SZyUDxD7M1_-TNM_2bSagox_yzIeYOpoBC-kPlNMdT-9trNOv3X7q4iLqrHyHY8_p5cheQ-GCrOGnAPjgrgb6bNGgX1H03HwC5q-mZXBzgQ&X-Bogus=DFSzswVLOezANCYfS5qBc2XyYJA4&_signature=_02B4Z6wo00001WyqqDQAAIDATwuGmbdoOXlsqqyAADk7e9';

const PARAMS = {
  aid: 1988,
  count: 30,
  cursor: 0,
  secUid: SEC_UID,
  cookie_enabled: true,
  screen_width: 0,
  screen_height: 0,
  browser_language: '',
  browser_platform: '',
  browser_name: '',
  browser_version: '',
  browser_online: '',
  timezone_name: 'Europe/London',
};

async function main() {
  const signer = new Signer(null, USER_AGENT);
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
  const { x_tt_params: xTtParams } = signature;
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
