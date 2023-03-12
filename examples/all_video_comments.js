const Signer = require("..");
const axios = require("axios"); // NOTE: not adding this to package.json, you'll need to install it manually
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.53";
const Referer = "https://www.tiktok.com/@haosmosromania/video/7206067410766433541"; // !!! Referer is required
const videoIdRegex = /\/(\d+)$/; // regex pattern to match the video ID at the end of the URL
const videoId = Referer.match(videoIdRegex)[1];
const VIDEO_ID = videoId;

const MSTOKEN = "G1lr_8nRB3udnK_fFzgBD7sxvc0PK6Osokd1IJMaVPVcoB4mwSW-D6MQjTdoJ2o20PLt_MWNgtsAr095wVSShdmn_XVFS34bURvakVglDyWAHncoV_jVJCRdiJRdbJBi_E_KD_G8vpFF9-aOaJrk";

const csvWriter = createCsvWriter({
  path: VIDEO_ID + "_comments.csv",
  header: [
    { id: "username", title: "Username" },
    { id: "handle", title: "Handle" },
    { id: "comment_language", title: "Comment Language" },
  ],
});

async function main() {
  const signer = new Signer(null, USER_AGENT);
  await signer.init();

  const totalComments = 574; // replace with the total number of comments for the video
  const maxCount = 50;
  const numRequests = Math.ceil(totalComments / maxCount);

  const comments = [];
  let cursor = 0;

  for (let i = 0; i < numRequests; i++) {
    const queryParams = {
        aweme_id: VIDEO_ID,
        cursor: cursor,
        max_count: maxCount,
        msToken: MSTOKEN,
        aid: 1988,
        app_language: 'ja-JP',
        app_name: 'tiktok_web',
        battery_info: 1,
        browser_language: 'en-US',
        browser_name: 'Mozilla',
        browser_online: true,
        browser_platform: 'Win32',
        browser_version: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.63',
        channel: 'tiktok_web',
        cookie_enabled: true,
        current_region: 'JP',
        device_id: '7165118680723998214',
        device_platform: 'web_pc',
        from_page: 'video',
        os: 'windows',
        priority_region: 'US',
        referer: '',
        region: 'US',
        screen_height: 1440,
        screen_width: 2560,
        webcast_language: 'en',
    };

    const qsObject = new URLSearchParams(queryParams);
    const qs = qsObject.toString();
    const unsignedUrl = `https://www.tiktok.com/api/comment/list/?${qs}`;
    const signature = await signer.sign(unsignedUrl);
    const navigator = await signer.navigator();
    await signer.close();

    const { signed_url } = signature;
    const { user_agent: userAgent } = navigator;
    const res = await testApiReq({ userAgent }, signed_url);
    const batchComments = res.comments;

    comments.push(...batchComments);
    cursor = res.cursor;
  }

  csvWriter.writeRecords(comments).then(() => {
    console.log("CSV file created successfully");
  });
}

async function testApiReq({ userAgent }, url) {
  const options = {
    method: "GET",
    headers: {
      "user-agent": userAgent,
      referer: Referer
    },
    url: url,
  };
  const response = await axios(options);
  const { comments, cursor } = response.data;
  const formattedComments = comments.map((comment) => {
    const user = comment.user;
    const username = user.nickname;
    const handle = user.unique_id; 
    return {
      username: username,
      handle: handle,
      comment_language: comment.comment_language,
    };
  });
  return { comments: formattedComments, cursor: cursor };
}

main();
