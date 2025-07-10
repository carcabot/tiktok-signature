import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Browser } from 'happy-dom';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const signer_script = fs.readFileSync(__dirname + "/javascript/signer.js", "utf8");
const x_bogus_script = fs.readFileSync(__dirname + "/javascript/xbogus.js", "utf8");

const browser = new Browser()
const page = browser.newPage()
page.evaluate(signer_script)
page.evaluate(x_bogus_script)


export function getSignature(url: string) {
    return page.evaluate(`generateSignature({ url: "${url}" })`)
}

export function getBogus(url: string, user_agent: string) {
    return page.evaluate(`generateBogus("${url}", "${user_agent}")`)
}

getSignature('http://tiktok.com/@oglandromania/video/7472851301529914646');