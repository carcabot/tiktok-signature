const puppeteer = require("puppeteer-extra")
const devices = require('puppeteer/DeviceDescriptors');
const iPhonex = devices['iPhone X'];
const pluginStealth = require("puppeteer-extra-plugin-stealth")
puppeteer.use(pluginStealth())
const fs = require('fs');

var url = process.argv[2]

const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"'
];

const options = {
    args,
    headless: true,
    ignoreHTTPSErrors: true,
    userDataDir: './tmp'
};


(async function main() {

    try {

        const browser = await puppeteer.launch(options);
        const page = await browser.newPage();
        await page.goto('file://' + __dirname + '/local.html', { waitUntil: 'load' });

        await page.emulate(iPhonex);
        const token = await page.evaluate(
            `
            url = '${url}';
            `
        );
        await new Promise(resolve => setTimeout(resolve, 150));
        console.log(await page.title());
        await browser.close();


    } catch (err) {
        console.error(err);
    }

})();
