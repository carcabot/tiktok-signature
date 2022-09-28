const Signer = require('../');
const axios = require('../node_modules/axios'); // NOTE: not adding this to package.json, you'll need to install it manually

// The `username` of your TikTok profile.
const USER_UNIQUE_ID = 'tiktok';
  
// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36 Edg/101.0.1210.53';

const PARAMS = {
  aid: "1988",
}
// If you're getting empty results change the verifyFp, msToken, X-Bogus and _signature params
const queryParams = {
  aid: '1988',
  verifyFp:"verify_dca8729afe5c502257ed30b0b070dbdb",
  msToken:"K8Xf-t_4RZ5n27zHsUPRyDIjpHQtfPeuHSvtbWzz0D0CQkX1UEyEdV0Xgx5BdbFPqKZ2McVCdlo1RM_u3o9FRglKoFa7TLZz2Yhd_fYRgWKhQDAq1TxQwLSTCz7Jp-EzVhopdNFO",
  "X-Bogus":"DFSzswVOLbUANCTQSwQvy2XyYJAm",
  _signature:"_02B4Z6wo00001S9DBBwAAIDADOIqsG3-iK0vQwCAAClJd0"
}

async function main() {
  const signer = new Signer(null, USER_AGENT);
  await signer.init();

  const qsObject = new URLSearchParams(PARAMS);
  const qs = qsObject.toString();

  const unsignedUrl = `https://www.tiktok.com/node/share/user/@${USER_UNIQUE_ID}?${qs}`
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

  const qsObject = new URLSearchParams(queryParams);
  const qs = qsObject.toString();
  
  const options = {
    method: 'GET',
    headers: {
      'user-agent': userAgent,
      'x-tt-params': xTtParams,
    },
    url: `https://www.tiktok.com/node/share/user/@${USER_UNIQUE_ID}/?${qs}`
  };
  return axios(options);
}

main();
