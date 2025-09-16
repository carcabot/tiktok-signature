import Utils from '../utils.js';

describe('Utils', () => {
  describe('generateVerifyFp', () => {
    test('should generate a valid verify_fp token', () => {
      const verifyFp = Utils.generateVerifyFp();

      expect(verifyFp).toBeDefined();
      expect(typeof verifyFp).toBe('string');
      expect(verifyFp).toMatch(/^verify_/);
    });

    test('should generate consistent tokens', () => {
      const token1 = Utils.generateVerifyFp();
      const token2 = Utils.generateVerifyFp();

      // Currently returns a fixed token for compatibility
      expect(token1).toBe(token2);
      expect(token1).toBe('verify_5b161567bda98b6a50c0414d99909d4b');
    });
  });

  describe('getRandomInt', () => {
    test('should generate random integer within range', () => {
      const min = 1;
      const max = 10;

      for (let i = 0; i < 100; i++) {
        const result = Utils.getRandomInt(min, max);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    test('should handle edge cases', () => {
      expect(Utils.getRandomInt(5, 5)).toBe(5);
      expect(Utils.getRandomInt(0, 0)).toBe(0);
      expect(Utils.getRandomInt(-10, -5)).toBeGreaterThanOrEqual(-10);
      expect(Utils.getRandomInt(-10, -5)).toBeLessThanOrEqual(-5);
    });

    test('should generate different values', () => {
      const values = new Set();
      for (let i = 0; i < 100; i++) {
        values.add(Utils.getRandomInt(1, 100));
      }
      expect(values.size).toBeGreaterThan(20);
    });
  });

  describe('generateDeviceId', () => {
    test('should generate a valid device ID', () => {
      const deviceId = Utils.generateDeviceId();

      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe('string');
      expect(deviceId).toMatch(/^7\d{18}$/); // Should start with 7 and be 19 digits total
    });

    test('should generate unique device IDs', () => {
      const deviceIds = new Set();
      for (let i = 0; i < 100; i++) {
        deviceIds.add(Utils.generateDeviceId());
      }
      expect(deviceIds.size).toBe(100);
    });
  });

  describe('generateMsToken', () => {
    test('should generate a valid msToken', () => {
      const msToken = Utils.generateMsToken();

      expect(msToken).toBeDefined();
      expect(typeof msToken).toBe('string');
      expect(msToken.length).toBe(107);
      expect(msToken).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    test('should generate unique msTokens', () => {
      const msTokens = new Set();
      for (let i = 0; i < 100; i++) {
        msTokens.add(Utils.generateMsToken());
      }
      expect(msTokens.size).toBe(100);
    });
  });
});