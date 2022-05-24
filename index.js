const { createCipheriv } = require('crypto');
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

  // Password for xttparams AES encryption
  password = 'webapp1.0+202106';

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

    let LOAD_SCRIPTS = ["signer.js"];
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
    let queryString = new URL(signed_url).searchParams.toString();

    return {
      signature: token,
      verify_fp: verify_fp,
      // csrf_session: csrf,
      signed_url: signed_url,
      x_tt_params: this.xttparams(queryString)
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

  xttparams(query_str) {
    query_str += '&is_encryption=1'

    // Encrypt query string using aes-128-cbc
    const cipher = createCipheriv("aes-128-cbc", this.password, this.password);
    return Buffer.concat([cipher.update(query_str), cipher.final()]).toString('base64');
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
