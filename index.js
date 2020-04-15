const puppeteer = require("puppeteer-extra");
const devices = require("puppeteer/DeviceDescriptors");
const iPhonex = devices["iPhone X"];
const pluginStealth = require("puppeteer-extra-plugin-stealth");

puppeteer.use(pluginStealth());

class Signer {
  userAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1";
  args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certifcate-errors",
    "--ignore-certifcate-errors-spki-list"
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
      args: this.args,
      headless: true,
      ignoreHTTPSErrors: true,
      userDataDir: "./tmp"
    };
  }

  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch(this.options);
    }

    this.page = await this.browser.newPage();

    let emulateTemplate = { ...iPhonex };
    emulateTemplate.viewport.width = getRandomInt(320, 1920);
    emulateTemplate.viewport.height = getRandomInt(320, 1920);
    emulateTemplate.viewport.deviceScaleFactor = getRandomInt(1, 3);
    emulateTemplate.viewport.isMobile = Math.random() > 0.5;
    emulateTemplate.viewport.hasTouch = Math.random() > 0.5;

    await this.page.emulate(emulateTemplate);
    await this.page.setUserAgent(this.userAgent);

    await this.page.goto("https://www.tiktok.com/trending?lang=en", {
      waitUntil: "load"
    });

    if (this.tac) {
      await this.page.evaluate(x => {
        window.tac = x;
      }, this.tac);
    }

    await this.page.evaluate(() => {
      var b = {};
      for (let x of window.webpackJsonp) {
        if (typeof x[1]["duD4"] === "function") {
          x[1]["duD4"](null, b);
          break;
        }
      }

      if (typeof b.sign !== "function") {
        throw "No function found";
      }

      window.generateSignature = function generateSignature(url) {
        return b.sign({ url: url });
      };
    }, this.tac);

    return this;
  }

  async sign(str) {
    let res = await this.page.evaluate(`generateSignature("${str}")`);
    return res;
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
