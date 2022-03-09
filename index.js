const url = require("url");
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
      // headless: false,
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

    this.page = await this.context.newPage();

    await this.page.goto(this.default_url, {
      waitUntil: "networkidle",
    });

    let LOAD_SCRIPTS = ["signer.js", "xttparams.js"];
    LOAD_SCRIPTS.forEach(async (script) => {
      await this.page.addScriptTag({
        path: `${__dirname}/javascript/${script}`,
      });
    });

    await this.page.evaluate(() => {
      window.generateSignature = function generateSignature(url) {
        if (typeof window.byted_acrawler.sign !== "function") {
          throw "No signature function found";
        }
        return window.byted_acrawler.sign({ url: url });
      };

      window.generateTTParams = function generateTTParams(queryObject) {
        if (typeof window.genXTTParams !== "function") {
          throw "No x-tt-params function found";
        }
        return window.genXTTParams(queryObject);
      };
    });
    return this;
  }

  async navigator() {
    // Get the "viewport" of the page, as reported by the page.
    const info = await this.page.evaluate(() => {
      return {
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
  async sign(link) {
    // generate valid verifyFp
    // let csrf = await this.getCsrfSessionId();
    let verify_fp = Utils.generateVerifyFp();
    let newUrl = link + "&verifyFp=" + verify_fp;
    let token = await this.page.evaluate(`generateSignature("${newUrl}")`);
    let signed_url = newUrl + "&_signature=" + token;
    let queryObject = url.parse(signed_url, true).query;
    return {
      signature: token,
      verify_fp: verify_fp,
      // csrf_session: csrf,
      signed_url: signed_url,
      x_tt_params: await this.page.evaluate((queryObject) => {
        return generateTTParams(queryObject);
      }, queryObject),
    };
  }

  async getCsrfSessionId() {
    var content = await this.page.cookies();
    for (let cookie of content) {
      if (cookie.name == "csrf_session_id") {
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

module.exports = Signer;
