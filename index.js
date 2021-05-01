const { devices, chromium } = require("playwright-chromium");
const Utils = require("./utils");
const iPhone11 = devices["iPhone 11 Pro"];
class Signer {
  userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (Windows NT 10.0; Win64; x64) Chrome/90.0.4430.85 Safari/537.36";
  args = [
    "--headless",
    "--disable-blink-features",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1920,1080",
    "--start-maximized",
  ];
  // Default TikTok loading page
  default_url = "https://www.tiktok.com/@rihanna?lang=en";

  constructor(default_url, userAgent, browser) {
    if (default_url) {
      this.default_url = default_url;
    }
    if (userAgent) {
      this.userAgent = userAgent;
    }

    if (browser) {
      this.browser = browser;
      this.isExternalBrowser = true;
    }

    this.args.push(`--user-agent="${this.userAgent}"`);

    this.options = {
      args: this.args,
      ignoreDefaultArgs: ["--mute-audio", "--hide-scrollbars"],
      ignoreHTTPSErrors: true,
    };
  }

  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch(this.options);
    }

    let emulateTemplate = {
      ...iPhone11,
      locale: "en-US",
      deviceScaleFactor: Utils.getRandomInt(1, 3),
      isMobile: Math.random() > 0.5,
      hasTouch: Math.random() > 0.5,
      userAgent: this.userAgent,
    };
    emulateTemplate.viewport.width = Utils.getRandomInt(320, 1920);
    emulateTemplate.viewport.height = Utils.getRandomInt(320, 1920);

    this.context = await this.browser.newContext({
      ...emulateTemplate,
    });

    let LOAD_SCRIPTS = ["signer.js"];
    LOAD_SCRIPTS.forEach(async (script) => {
      await this.context.addInitScript({
        path: `${__dirname}/javascript/${script}`,
      });
    });

    this.page = await this.context.newPage();
    await this.page.goto(this.default_url, {
      waitUntil: "load",
    });

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

  async navigator() {
    // Get the "viewport" of the page, as reported by the page.
    const info = await this.page.evaluate(() => {
      return {
        // width: document.documentElement.clientWidth,
        // height: document.documentElement.clientHeight,
        deviceScaleFactor: window.devicePixelRatio,
        user_agent: window.navigator.userAgent,
        browser_language: window.navigator.language,
        browser_platform: window.navigator.platform,
        browser_name: window.navigator.appCodeName,
        browser_version: window.navigator.appVersion,
      };
    });
    return info;
  }
  async sign(url) {
    // generate valid verifyFp
    let verify_fp = Utils.generateVerifyFp();
    let newUrl = url + "&verifyFp=" + verify_fp;
    let token = await this.page.evaluate(`generateSignature("${newUrl}")`);
    let signed_url = newUrl + "&_signature=" + token;
    return {
      signature: token,
      verify_fp: verify_fp,
      signed_url: signed_url,
    };
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

module.exports = Signer;
