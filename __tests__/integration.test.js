import axios from 'axios';

describe('Integration Tests', () => {
  const API_BASE = 'http://localhost:8080';
  const TIKTOK_API_BASE = 'https://m.tiktok.com/api';

  describe('Signature Generation', () => {
    test('should generate valid signature structure', async () => {
      const testUrl = `${TIKTOK_API_BASE}/post/item_list/?aid=1988&count=30`;

      const response = await axios.post(`${API_BASE}/signature`, testUrl, {
        headers: { 'Content-Type': 'text/plain' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');

      const data = response.data.data;
      expect(data.signature).toMatch(/^_[0-9A-Za-z]{40,60}$/);
      expect(data.verify_fp).toMatch(/^verify_[a-z0-9]{8}_[a-zA-Z0-9]{5}_[a-zA-Z0-9]{4}_[a-zA-Z0-9]{4}_[a-zA-Z0-9]{4}_[a-zA-Z0-9]{12}$/);
      expect(data['x-bogus']).toBeDefined();
      expect(data['x-gnarly']).toBeDefined();
      expect(data['x-gnarly']).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(data['device-id']).toBeDefined();
      expect(data['device-id']).toMatch(/^7\d{18}$/);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('number');
      expect(data['x-tt-params']).toMatch(/^[A-Za-z0-9+/]+=*$/);
    }, 30000);

    test('should handle trending endpoint', async () => {
      const testUrl = `${TIKTOK_API_BASE}/recommend/item_list/?aid=1988&count=30`;

      const response = await axios.post(`${API_BASE}/signature`, testUrl, {
        headers: { 'Content-Type': 'text/plain' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.data.signed_url).toContain('recommend/item_list');
    }, 30000);

    test('should handle user info endpoint', async () => {
      const testUrl = `${TIKTOK_API_BASE}/user/detail/?aid=1988&secUid=TEST_SEC_UID`;

      const response = await axios.post(`${API_BASE}/signature`, testUrl, {
        headers: { 'Content-Type': 'text/plain' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.data.signed_url).toContain('user/detail');
    }, 30000);

    test('should handle comments endpoint', async () => {
      const testUrl = `${TIKTOK_API_BASE}/comment/list/?aid=1988&aweme_id=123456&count=50`;

      const response = await axios.post(`${API_BASE}/signature`, testUrl, {
        headers: { 'Content-Type': 'text/plain' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.data.signed_url).toContain('comment/list');
    }, 30000);

    test('should handle hashtag endpoint', async () => {
      const testUrl = `${TIKTOK_API_BASE}/challenge/item_list/?aid=1988&challengeID=12345&count=30`;

      const response = await axios.post(`${API_BASE}/signature`, testUrl, {
        headers: { 'Content-Type': 'text/plain' }
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.data.signed_url).toContain('challenge/item_list');
    }, 30000);
  });

  describe('Performance', () => {
    test('should handle multiple requests efficiently', async () => {
      const startTime = Date.now();
      const requests = [];

      for (let i = 0; i < 5; i++) {
        const url = `${TIKTOK_API_BASE}/test/?aid=1988&id=${i}`;
        requests.push(
          axios.post(`${API_BASE}/signature`, url, {
            headers: { 'Content-Type': 'text/plain' }
          })
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('ok');
      });

      const avgTime = (endTime - startTime) / 5;
      expect(avgTime).toBeLessThan(10000);
    }, 60000);
  });

  describe('Error Recovery', () => {
    test('should handle malformed URLs gracefully', async () => {
      const testUrl = 'not-a-valid-url';

      try {
        await axios.post(`${API_BASE}/signature`, testUrl, {
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 30000);

    test('should handle empty body', async () => {
      try {
        await axios.post(`${API_BASE}/signature`, '', {
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 30000);
  });
});