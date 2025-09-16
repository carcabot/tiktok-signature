import Signer from '../index.js';
import { jest } from '@jest/globals';

describe('Signer', () => {
  let signer;

  afterEach(async () => {
    if (signer) {
      await signer.close();
      signer = null;
    }
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      signer = new Signer();

      expect(signer.default_url).toBe('https://www.tiktok.com/@rihanna?lang=en');
      expect(signer.userAgent).toContain('Mozilla');
      expect(signer.password).toBe('webapp1.0+202106');
      expect(signer.isExternalBrowser).toBeUndefined();
      expect(signer.deviceId).toBeDefined();
      expect(signer.msToken).toBeDefined();
      expect(signer.deviceId).toMatch(/^7\d{18}$/);
      expect(signer.msToken.length).toBe(107);
    });

    test('should accept custom URL', () => {
      const customUrl = 'https://www.tiktok.com/@test';
      signer = new Signer(customUrl);

      expect(signer.default_url).toBe(customUrl);
    });

    test('should accept custom user agent', () => {
      const customUserAgent = 'CustomAgent/1.0';
      signer = new Signer(null, customUserAgent);

      expect(signer.userAgent).toBe(customUserAgent);
      expect(signer.args).toContain(`--user-agent="${customUserAgent}"`);
    });

    test('should accept external browser', () => {
      const mockBrowser = { name: 'mockBrowser' };
      signer = new Signer(null, null, mockBrowser);

      expect(signer.browser).toBe(mockBrowser);
      expect(signer.isExternalBrowser).toBe(true);
    });

    test('should set proper browser args', () => {
      signer = new Signer();

      expect(signer.args).toContain('--disable-blink-features');
      expect(signer.args).toContain('--disable-blink-features=AutomationControlled');
      expect(signer.args).toContain('--disable-infobars');
      expect(signer.args).toContain('--window-size=1920,1080');
      expect(signer.args).toContain('--start-maximized');
    });
  });

  describe('xttparams', () => {
    test('should encrypt query string with AES', () => {
      signer = new Signer();
      const queryStr = 'test=value&foo=bar';

      const encrypted = signer.xttparams(queryStr);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    test('should add is_encryption parameter', () => {
      signer = new Signer();
      const queryStr = 'test=value';

      const encrypted = signer.xttparams(queryStr);

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
    });

    test('should produce consistent encryption with same input', () => {
      signer = new Signer();
      const queryStr = 'test=value&foo=bar';

      const encrypted1 = signer.xttparams(queryStr);
      const encrypted2 = signer.xttparams(queryStr);

      expect(encrypted1).toBe(encrypted2);
    });
  });

  describe('generateXBogus', () => {
    test('should generate valid X-Bogus header', () => {
      signer = new Signer();
      const url = 'https://m.tiktok.com/api/post/item_list/';
      const queryString = 'aid=1988&count=30';
      const timestamp = 1234567890;

      const xBogus = signer.generateXBogus(url, queryString, timestamp);

      expect(xBogus).toBeDefined();
      expect(typeof xBogus).toBe('string');
      expect(xBogus.length).toBeGreaterThan(20);
      expect(xBogus).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    test('should generate consistent X-Bogus with same input', () => {
      signer = new Signer();
      const url = 'https://m.tiktok.com/api/post/item_list/';
      const queryString = 'aid=1988&count=30';
      const timestamp = 1234567890;

      const xBogus1 = signer.generateXBogus(url, queryString, timestamp);
      const xBogus2 = signer.generateXBogus(url, queryString, timestamp);

      expect(xBogus1).toBe(xBogus2);
    });

    test('should handle invalid input gracefully', () => {
      signer = new Signer();
      // The method handles null input without throwing
      const xBogus = signer.generateXBogus(null, null, null);

      expect(xBogus).toBeDefined();
      expect(typeof xBogus).toBe('string');
      expect(xBogus.length).toBeGreaterThan(10);
    });
  });

  describe('generateXGnarly', () => {
    test('should generate valid X-Gnarly header', () => {
      signer = new Signer();
      const queryString = 'aid=1988&count=30';
      const verifyFp = 'verify_test123';
      const timestamp = 1234567890;

      const xGnarly = signer.generateXGnarly(queryString, verifyFp, timestamp);

      expect(xGnarly).toBeDefined();
      expect(typeof xGnarly).toBe('string');
      expect(xGnarly.length).toBeGreaterThan(20);
      expect(xGnarly).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    test('should generate consistent X-Gnarly with same input', () => {
      signer = new Signer();
      const queryString = 'aid=1988&count=30';
      const verifyFp = 'verify_test123';
      const timestamp = 1234567890;

      const xGnarly1 = signer.generateXGnarly(queryString, verifyFp, timestamp);
      const xGnarly2 = signer.generateXGnarly(queryString, verifyFp, timestamp);

      expect(xGnarly1).toBe(xGnarly2);
    });

    test('should handle invalid input gracefully', () => {
      signer = new Signer();
      // The method handles null input without throwing
      const xGnarly = signer.generateXGnarly(null, null, null);

      expect(xGnarly).toBeDefined();
      expect(typeof xGnarly).toBe('string');
      expect(xGnarly.length).toBeGreaterThan(20);
    });
  });

  describe('close', () => {
    test('should clean up resources', async () => {
      signer = new Signer();
      const mockBrowser = { close: jest.fn() };
      signer.browser = mockBrowser;
      signer.page = { close: jest.fn() };

      await signer.close();

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(signer.browser).toBeNull();
      expect(signer.page).toBeNull();
    });

    test('should not close external browser', async () => {
      const mockBrowser = { close: jest.fn() };
      signer = new Signer(null, null, mockBrowser);
      signer.page = { close: jest.fn() };

      await signer.close();

      expect(mockBrowser.close).not.toHaveBeenCalled();
      expect(signer.browser).toBe(mockBrowser);
      expect(signer.page).toBeNull();
    });

    test('should handle missing browser gracefully', async () => {
      signer = new Signer();

      await expect(signer.close()).resolves.not.toThrow();
    });
  });
});