import { createCipheriv } from "crypto";
import { devices, chromium } from "playwright-chromium";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Utils from "../utils.js";
import { config } from "./config.js";
import { validators, ValidationError } from "./validators.js";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iPhone11 = devices["iPhone 11 Pro"];

class Signer {
  constructor(defaultUrl, userAgent, browser) {
    this.default_url = defaultUrl || config.browser.defaultUrl;
    this.userAgent = userAgent || config.browser.userAgent;
    this.password = config.encryption.password;
    this.scripts = config.scripts;
    this.isInitialized = false;
    this.initializationPromise = null;

    if (browser) {
      this.browser = browser;
      this.isExternalBrowser = true;
    }

    this.args = [
      ...config.browser.args,
      `--user-agent="${this.userAgent}"`,
    ];

    this.options = {
      headless: config.browser.headless,
      args: this.args,
      ignoreDefaultArgs: ["--mute-audio", "--hide-scrollbars"],
      ignoreHTTPSErrors: true,
    };

    logger.info('Signer instance created', {
      defaultUrl: this.default_url,
      headless: config.browser.headless,
    });
  }

  async init() {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInit();
    await this.initializationPromise;
    this.isInitialized = true;
  }

  async _performInit() {
    try {
      logger.info('Initializing browser...');

      if (!this.browser) {
        this.browser = await chromium.launch(this.options);
      }

      const emulateTemplate = {
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
        const request = route.request();
        // Allow scripts from our local file system, block external scripts
        if (request.resourceType() === "script" && !request.url().startsWith("file://")) {
          return route.abort();
        }
        return route.continue();
      });

      logger.info('Loading default URL...');
      await this.page.goto(this.default_url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      await this._loadScripts();
      await this._initializeSignatureFunctions();

      logger.info('Browser initialization completed');
    } catch (error) {
      logger.error('Failed to initialize browser', error);
      throw new Error(`Browser initialization failed: ${error.message}`);
    }
  }

  async _loadScripts() {
    // For this file location at src/signer.js, go up one level to get to project root
    const projectRoot = dirname(dirname(__filename));
    const scriptsDir = join(projectRoot, 'javascript');

    logger.debug(`Scripts directory: ${scriptsDir}`);

    for (const script of this.scripts) {
      try {
        const scriptPath = join(scriptsDir, script);
        logger.debug(`Loading script: ${scriptPath}`);
        await this.page.addScriptTag({
          path: scriptPath,
        });
        logger.debug(`Script loaded: ${script}`);
      } catch (error) {
        logger.error(`Failed to load script: ${script}`, error);
        throw new Error(`Failed to load script ${script}: ${error.message}`);
      }
    }
  }

  async _initializeSignatureFunctions() {
    try {
      // Wait for the scripts to initialize their global objects
      await this.page.waitForFunction(() => {
        return typeof window.byted_acrawler !== 'undefined' &&
               typeof window.byted_crawler !== 'undefined';
      }, { timeout: 30000 });

      await this.page.evaluate(() => {
        window.generateSignature = function generateSignature(url) {
          if (typeof window.byted_acrawler.sign !== "function") {
            throw new Error("No signature function found");
          }
          return window.byted_acrawler.sign({ url: url });
        };

        window.generateBogus = function generateBogus(params, userAgent) {
          if (typeof window.byted_crawler.frontierSign !== "function") {
            throw new Error("No X-Bogus function found");
          }
          return window.byted_crawler.frontierSign(params);
        };
      });

      logger.debug('Signature functions initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize signature functions', error);
      throw new Error(`Failed to initialize signature functions: ${error.message}`);
    }
  }

  async navigator() {
    if (!this.isInitialized) {
      throw new Error('Signer not initialized. Call init() first');
    }

    try {
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

      logger.debug('Navigator info retrieved', info);
      return info;
    } catch (error) {
      logger.error('Failed to get navigator info', error);
      throw new Error(`Failed to get navigator info: ${error.message}`);
    }
  }

  async sign(url) {
    if (!this.isInitialized) {
      throw new Error('Signer not initialized. Call init() first');
    }

    try {
      const sanitizedUrl = validators.sanitizeUrl(url);
      validators.isValidUrl(sanitizedUrl);

      logger.info('Generating signature for URL', { url: sanitizedUrl });

      const verify_fp = Utils.generateVerifyFp();
      const newUrl = sanitizedUrl + "&verifyFp=" + verify_fp;

      const token = await this.page.evaluate(`generateSignature("${newUrl}")`);
      if (!token) {
        throw new Error('Failed to generate signature token');
      }

      const signed_url = newUrl + "&_signature=" + token;
      const queryString = new URL(signed_url).searchParams.toString();

      const bogus = await this.page.evaluate(`generateBogus("${queryString}","${this.userAgent}")`);
      if (!bogus) {
        throw new Error('Failed to generate X-Bogus');
      }

      const finalSignedUrl = signed_url + "&X-Bogus=" + bogus;

      const result = {
        signature: token,
        verify_fp: verify_fp,
        signed_url: finalSignedUrl,
        "x-tt-params": this.xttparams(queryString),
        "x-bogus": bogus,
      };

      validators.validateSignatureResponse(result);
      logger.info('Signature generated successfully');

      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error('Validation error during signature generation', error);
        throw error;
      }
      logger.error('Failed to generate signature', error);
      throw new Error(`Failed to generate signature: ${error.message}`);
    }
  }

  xttparams(query_str) {
    try {
      query_str += "&is_encryption=1";

      const cipher = createCipheriv("aes-128-cbc", this.password, this.password);
      const encrypted = Buffer.concat([
        cipher.update(query_str),
        cipher.final()
      ]).toString("base64");

      logger.debug('X-TT-Params generated');
      return encrypted;
    } catch (error) {
      logger.error('Failed to generate x-tt-params', error);
      throw new Error(`Failed to generate x-tt-params: ${error.message}`);
    }
  }

  async close() {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser && !this.isExternalBrowser) {
        await this.browser.close();
        this.browser = null;
      }

      this.page = null;
      this.isInitialized = false;
      this.initializationPromise = null;

      logger.info('Signer closed successfully');
    } catch (error) {
      logger.error('Error closing signer', error);
      throw new Error(`Failed to close signer: ${error.message}`);
    }
  }
}

export default Signer;