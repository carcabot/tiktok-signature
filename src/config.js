export const config = {
  server: {
    port: process.env.PORT || 8080,
    timeout: process.env.TIMEOUT || 60 * 60 * 1000,
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      headers: process.env.CORS_HEADERS || '*',
    },
  },
  browser: {
    headless: process.env.BROWSER_HEADLESS !== 'false',
    defaultUrl: process.env.DEFAULT_URL || 'https://www.tiktok.com/@rihanna?lang=en',
    userAgent: process.env.USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36',
    args: [
      '--disable-blink-features',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--start-maximized',
    ],
  },
  encryption: {
    password: 'webapp1.0+202106',
  },
  scripts: [
    'signer.js',
    'webmssdk.js',
    'xbogus.js',
  ],
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
};