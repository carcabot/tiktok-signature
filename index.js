const puppeteer = require("puppeteer-extra");
// const devices = require('puppeteer/DeviceDescriptors');
// const iPhonex = devices['iPhone X'];
const pluginStealth = require("puppeteer-extra-plugin-stealth");

puppeteer.use(pluginStealth());

class Signer {
  userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36";
  args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certifcate-errors",
    "--ignore-certifcate-errors-spki-list",
    "--host-rules=MAP tiktok.com 127.0.0.1"
  ];

  constructor(userAgent, tac) {
    if (userAgent) {
      this.userAgent = userAgent;
    }

    if (tac) {
      this.tac = tac;
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
    this.browser = await puppeteer.launch(this.options);
    this.page = await this.browser.newPage();
    // await this.page.emulate(iPhonex);
    await this.page.setUserAgent(this.userAgent);

    // await this.page.goto('file://' + __dirname + '/index.html', { waitUntil: 'load' });
    await this.page.goto("http://tiktok.com:8080/index.html", {
      waitUntil: "load"
    });

    if (this.tac) {
      await this.page.evaluate(x => {
        window.tac = x;
      }, this.tac);
    }

    return this;
  }

  async getTac() {
    this.browser = await puppeteer.launch(this.options);
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(this.userAgent);

    await this.page.goto("https://www.tiktok.com/trending", {
      waitUntil: "load"
    });

    const data = await this.page.content();

    var token = data.match(
      new RegExp("<script>tac='" + "(.+?)" + "'</script>", "ig")
    );

    return token;
  }

  async sign(str) {
    let res = await this.page.evaluate(`generateSignature("${str}")`);
    return res;
  }

  async close() {
    await this.browser.close();
    this.browser = null;
    this.page = null;
  }
}

module.exports = Signer;
