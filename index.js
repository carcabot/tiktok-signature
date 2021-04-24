const { webkit, devices } = require("playwright-webkit");
const iPhone11 = devices["iPhone 11 Pro"];
const fs = require("fs");

class Signer {
  userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (Windows NT 10.0; Win64; x64) Chrome/90.0.4430.85 Safari/537.36";
  args = [
    "--headless",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1920,1080",
    "--start-maximized",
  ];

  constructor(userAgent, browser) {
    if (userAgent) {
      this.userAgent = userAgent;
    }

    if (browser) {
      this.browser = browser;
      this.isExternalBrowser = true;
    }

    this.args.push(`--user-agent="${this.userAgent}"`);

    this.options = {
      args: [],
      ignoreDefaultArgs: ["--mute-audio", "--hide-scrollbars"],
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

    // SEND COOKIES
    // const cookies = fs.readFileSync("config/cookies.json", "utf8");
    // const deserializedCookies = JSON.parse(cookies);
    // await this.context.addCookies(deserializedCookies);

    this.page = await this.context.newPage();
    await this.page.goto("https://www.tiktok.com/@rihanna?lang=en", {
      waitUntil: "load",
    });

    // WRITE ECOOKIES
    // const cookies = await this.context.cookies();
    // const cookieJson = JSON.stringify(cookies);

    // fs.writeFileSync("config/cookies.json", cookieJson);

    await this.page.evaluate(() => {
      if (typeof window.byted_acrawler.sign !== "function") {
        throw "No signature function found";
      }

      window.generateSignature = function generateSignature(url) {
        return window.byted_acrawler.sign({ url: url });
      };
    });

    return this;
  }

  async sign(url) {
    // generate valid verifyFp
    this.verifyFp = await this.generateVerifyFp();
    url = url + "&verifyFp=" + this.verifyFp;
    let res = await this.page.evaluate(`generateSignature("${url}")`);
    return res;
  }

  async generateVerifyFp() {
    var e = Date.now();
    var t = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(
        ""
      ),
      e = t.length,
      n = Date.now().toString(36),
      r = [];
    (r[8] = r[13] = r[18] = r[23] = "_"), (r[14] = "4");
    for (var o = 0, i = void 0; o < 36; o++)
      r[o] ||
        ((i = 0 | (Math.random() * e)), (r[o] = t[19 == o ? (3 & i) | 8 : i]));
    return "verify_" + n + "_" + r.join("");
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
