const { webkit, devices } = require("playwright");
const iPhone11 = devices["iPhone 11 Pro"];

class Signer {
  userAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1";
  args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certifcate-errors",
    "--ignore-certifcate-errors-spki-list",
  ];

  constructor(userAgent, tac, browser) {
    if (userAgent) {
      this.userAgent = userAgent;
    }

    if (tac) {
      this.tac = tac;
    }

    if (browser) {
      this.browser = browser;
      this.isExternalBrowser = true;
    }

    this.args.push(`--user-agent="${this.userAgent}"`);

    this.options = {
      // args: this.args,
      ignoreDefaultArgs: ["--mute-audio", "--hide-scrollbars"],
      headless: true,
      ignoreHTTPSErrors: true,
    };
  }

  async init() {
    if (!this.browser) {
      this.browser = await webkit.launch(this.options);
    }

    let emulateTemplate = { ...iPhone11 };
    emulateTemplate.viewport.width = getRandomInt(320, 1920);
    emulateTemplate.viewport.height = getRandomInt(320, 1920);

    this.context = await this.browser.newContext({
      ...emulateTemplate,
      deviceScaleFactor: getRandomInt(1, 3),
      isMobile: Math.random() > 0.5,
      hasTouch: Math.random() > 0.5,
      userAgent: this.userAgent,
    });

    this.page = await this.context.newPage();
    await this.page.goto("https://www.tiktok.com/trending?lang=en", {
      waitUntil: "load",
    });
    await this.page.click(".swiper-wrapper");

    if (this.tac) {
      await this.page.evaluate((x) => {
        window.tac = x;
      }, this.tac);
    }

    await this.page.evaluate(() => {
      window.onload = function () {
        var element = document.getElementById("video");
        console.log(element);
        element.muted = "muted";
      };
      if (typeof window.byted_acrawler.sign !== "function") {
        throw "No function found";
      }

      window.generateSignature = function generateSignature(
        url,
        verifyFp = null
      ) {
        let newUrl = url;
        if (verifyFp) {
          newUrl = newUrl + "&verifyFp=" + verifyFp;
        }
        return window.byted_acrawler.sign({ url: newUrl });
      };
    }, this.tac);

    return this;
  }

  async sign(str) {
    let verifyFp = await this.getVerifyFp();
    let res = await this.page.evaluate(
      `generateSignature("${str}", "${verifyFp}")`
    );
    return res;
  }

  async getVerifyFp() {
    var content = await this.context.cookies();
    for (let cookie of content) {
      if (cookie.name == "s_v_web_id") {
        return cookie.value;
      }
    }
    return null;
  }

  async close() {
    if (this.browser && !this.isExternalBrowser) {
      await this.browser.close();
      this.browser = null;
    }
    if (this.page) {
      this.page = null;
    }
  }
}

function getRandomInt(a, b) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  const diff = max - min + 1;
  return min + Math.floor(Math.random() * Math.floor(diff));
}

module.exports = Signer;
