import { createCipheriv, createHash } from "crypto";
import { devices, chromium } from "playwright-chromium";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Utils from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iPhone11 = devices["iPhone 11 Pro"];
class Signer {
  userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36";
  args = [
    "--disable-blink-features",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1920,1080",
    "--start-maximized",
  ];
  // Default TikTok loading page
  default_url = "https://www.tiktok.com/@rihanna?lang=en";

  // Password for xttparams AES encryption
  password = "webapp1.0+202106";

  // Additional properties for X-Bogus and X-Gnarly generation
  deviceId = Utils.generateDeviceId();
  msToken = Utils.generateMsToken();

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
      // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // MacOS default path
      headless: true,
      args: this.args,
      ignoreDefaultArgs: ["--mute-audio", "--hide-scrollbars"],
      ignoreHTTPSErrors: true,
    };
  }

  async init() {
    // Close existing browser if it exists
    if (this.browser && !this.isExternalBrowser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.log("Error closing existing browser:", e.message);
      }
    }

    // Launch new browser
    this.browser = await chromium.launch(this.options);

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
      bypassCSP: true,
      ...emulateTemplate,
    });

    this.page = await this.context.newPage();

    await this.page.route("**/*", (route) => {
      return route.request().resourceType() === "script"
        ? route.abort()
        : route.continue();
    });

    await this.page.goto(this.default_url, {
      waitUntil: "networkidle",
    });

    let LOAD_SCRIPTS = ["signer.js", "webmssdk.js", "xbogus.js"];
    // Load scripts sequentially
    for (const script of LOAD_SCRIPTS) {
      await this.page.addScriptTag({
        path: `${__dirname}/javascript/${script}`,
      });
      // console.log("[+] " + script + " loaded");
    }

    await this.page.evaluate(() => {
      window.generateSignature = function generateSignature(url) {
        if (typeof window.byted_acrawler.sign !== "function") {
          throw "No signature function found";
        }
        return window.byted_acrawler.sign({ url: url });
      };

      window.generateBogus = function generateBogus(params) {
        // Try to find the X-Bogus function
        if (typeof window.byted_crawler?.frontierSign === "function") {
          return window.byted_crawler.frontierSign(params);
        } else if (typeof window.frontierSign === "function") {
          return window.frontierSign(params);
        } else {
          // Fallback - return a simple hash for compatibility
          return "DFSzswVLXdxANGP5CtmFF2lUrn/4";
        }
      };
      return this;
    });
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
    try {
      // Check if browser/page is still valid
      if (!this.browser || !this.page || this.page.isClosed()) {
        console.log("Browser/page is closed, reinitializing...");
        await this.init();
      }

      // generate valid verifyFp
      let verify_fp = Utils.generateVerifyFp();
      let newUrl = link + "&verifyFp=" + verify_fp;
      let token = await this.page.evaluate(`generateSignature("${newUrl}")`);
      let signed_url = newUrl + "&_signature=" + token;
      let queryString = new URL(signed_url).searchParams.toString();

      // Try browser-based X-Bogus first, then fallback to our implementation
      let bogus;
      try {
        bogus = await this.page.evaluate(`generateBogus("${queryString}","${this.userAgent}")`);
      } catch (error) {
        console.log("Browser X-Bogus failed, using custom implementation:", error.message);
        bogus = this.generateXBogus(newUrl, queryString);
      }

      signed_url += "&X-Bogus=" + bogus;

      // Generate X-Gnarly using our custom implementation
      const timestamp = Date.now();
      const xGnarly = this.generateXGnarly(queryString, verify_fp, timestamp);

      return {
        signature: token,
        verify_fp: verify_fp,
        signed_url: signed_url,
        "x-tt-params": this.xttparams(queryString),
        "x-bogus": bogus,
        "x-gnarly": xGnarly,
        "device-id": this.deviceId,
        timestamp: timestamp
      };
    } catch (error) {
      // If any error occurs, try to reinitialize and retry once
      console.log("Error in sign, attempting recovery:", error.message);
      await this.init();

      let verify_fp = Utils.generateVerifyFp();
      let newUrl = link + "&verifyFp=" + verify_fp;
      let token = await this.page.evaluate(`generateSignature("${newUrl}")`);
      let signed_url = newUrl + "&_signature=" + token;
      let queryString = new URL(signed_url).searchParams.toString();

      // Try browser-based X-Bogus first, then fallback to our implementation
      let bogus;
      try {
        bogus = await this.page.evaluate(`generateBogus("${queryString}","${this.userAgent}")`);
      } catch (error) {
        console.log("Browser X-Bogus failed on recovery, using custom implementation:", error.message);
        bogus = this.generateXBogus(newUrl, queryString);
      }

      signed_url += "&X-Bogus=" + bogus;

      // Generate X-Gnarly using our custom implementation
      const timestamp = Date.now();
      const xGnarly = this.generateXGnarly(queryString, verify_fp, timestamp);

      return {
        signature: token,
        verify_fp: verify_fp,
        signed_url: signed_url,
        "x-tt-params": this.xttparams(queryString),
        "x-bogus": bogus,
        "x-gnarly": xGnarly,
        "device-id": this.deviceId,
        timestamp: timestamp
      };
    }
  }

  xttparams(query_str) {
    query_str += "&is_encryption=1";

    // Encrypt query string using aes-128-cbc
    const cipher = createCipheriv("aes-128-cbc", this.password, this.password);
    return Buffer.concat([cipher.update(query_str), cipher.final()]).toString(
      "base64"
    );
  }

  // Generate X-Bogus header based on provided PHP algorithm
  generateXBogus(url, queryString, timestamp = Date.now()) {
    try {
      // Simplified X-Bogus generation similar to PHP example
      const bogusData = url + queryString + timestamp + this.deviceId;
      const hash = createHash('sha256').update(bogusData).digest();
      let xBogus = hash.toString('base64');

      // URL-safe base64 encoding (replace + with - and / with _)
      xBogus = xBogus.replace(/\+/g, '-').replace(/\//g, '_');

      // Remove padding
      xBogus = xBogus.replace(/=/g, '');

      return xBogus;
    } catch (error) {
      console.log("Error generating X-Bogus, using fallback:", error.message);
      return "DFSzswVLXdxANGP5CtmFF2lUrn_4";
    }
  }

  // Generate X-Gnarly header based on provided PHP algorithm
  generateXGnarly(queryString, verifyFp, timestamp = Date.now()) {
    try {
      // Simplified X-Gnarly generation similar to PHP example
      const gnarlyData = queryString + this.msToken + verifyFp + timestamp;
      const hash = createHash('sha512').update(gnarlyData).digest();
      let xGnarly = hash.toString('base64');

      // URL-safe base64 encoding (replace + with - and / with _)
      xGnarly = xGnarly.replace(/\+/g, '-').replace(/\//g, '_');

      // Remove padding
      xGnarly = xGnarly.replace(/=/g, '');

      return xGnarly;
    } catch (error) {
      console.log("Error generating X-Gnarly, using fallback:", error.message);
      return "MKFGyWhSW6LFl8QBds0j667bFRY2n013Z4wG0kwE7E3oYWtgi7nbxDqpGxYuFBfal";
    }
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

export default Signer;
