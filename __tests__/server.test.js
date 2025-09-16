import request from 'supertest';
import { spawn } from 'child_process';

describe('Signature Server', () => {
  let serverProcess;
  const baseUrl = 'http://localhost:8080';

  beforeAll((done) => {
    serverProcess = spawn('node', ['listen.js'], {
      env: { ...process.env, PORT: '8080' },
      detached: false,
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('TikTok Signature server started on PORT')) {
        setTimeout(done, 1000);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server error: ${data}`);
    });

    setTimeout(done, 5000);
  }, 10000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('OPTIONS /signature', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(baseUrl)
        .options('/signature')
        .timeout(15000)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-headers']).toBe('*');
    }, 20000);
  });

  describe('POST /signature', () => {
    test('should generate signature for valid TikTok URL', async () => {
      const testUrl = 'https://m.tiktok.com/api/post/item_list/?aid=1988&count=30';

      const response = await request(baseUrl)
        .post('/signature')
        .send(testUrl)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.status).toBe('ok');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.signature).toBeDefined();
      expect(response.body.data.verify_fp).toBeDefined();
      expect(response.body.data.signed_url).toContain(testUrl);
      expect(response.body.data['x-tt-params']).toBeDefined();
      expect(response.body.data['x-bogus']).toBeDefined();
      expect(response.body.data['x-gnarly']).toBeDefined();
      expect(response.body.data['device-id']).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.navigator).toBeDefined();
    }, 30000);

    test('should include navigator information', async () => {
      const testUrl = 'https://m.tiktok.com/api/test';

      const response = await request(baseUrl)
        .post('/signature')
        .send(testUrl)
        .expect(200);

      const navigator = response.body.data.navigator;
      expect(navigator.deviceScaleFactor).toBeDefined();
      expect(navigator.user_agent).toBeDefined();
      expect(navigator.browser_language).toBeDefined();
      expect(navigator.browser_platform).toBeDefined();
      expect(navigator.browser_name).toBeDefined();
      expect(navigator.browser_version).toBeDefined();
    }, 30000);

    test('should handle concurrent requests', async () => {
      const testUrl = 'https://m.tiktok.com/api/concurrent';
      const requests = [];

      for (let i = 0; i < 3; i++) {
        requests.push(
          request(baseUrl)
            .post('/signature')
            .send(testUrl)
        );
      }

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.data.signature).toBeDefined();
      });
    }, 45000);

    test('should add verifyFp to URL', async () => {
      const testUrl = 'https://m.tiktok.com/api/test?param=value';

      const response = await request(baseUrl)
        .post('/signature')
        .send(testUrl)
        .expect(200);

      expect(response.body.data.signed_url).toContain('verifyFp=verify_');
      expect(response.body.data.verify_fp).toMatch(/^verify_/);
    }, 30000);

    test('should add X-Bogus to signed URL', async () => {
      const testUrl = 'https://m.tiktok.com/api/test';

      const response = await request(baseUrl)
        .post('/signature')
        .send(testUrl)
        .expect(200);

      expect(response.body.data.signed_url).toContain('X-Bogus=');
      expect(response.body.data['x-bogus']).toBeDefined();
      expect(response.body.data['x-bogus'].length).toBeGreaterThan(0);
    }, 30000);

    test('should include X-Gnarly header', async () => {
      const testUrl = 'https://m.tiktok.com/api/test';

      const response = await request(baseUrl)
        .post('/signature')
        .send(testUrl)
        .expect(200);

      expect(response.body.data['x-gnarly']).toBeDefined();
      expect(response.body.data['x-gnarly'].length).toBeGreaterThan(20);
      expect(response.body.data['x-gnarly']).toMatch(/^[A-Za-z0-9\-_]+$/);
    }, 30000);

    test('should include device ID and timestamp', async () => {
      const testUrl = 'https://m.tiktok.com/api/test';

      const response = await request(baseUrl)
        .post('/signature')
        .send(testUrl)
        .expect(200);

      expect(response.body.data['device-id']).toBeDefined();
      expect(response.body.data['device-id']).toMatch(/^7\d{18}$/);
      expect(response.body.data.timestamp).toBeDefined();
      expect(typeof response.body.data.timestamp).toBe('number');
      expect(response.body.data.timestamp).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error handling', () => {
    test('should return 404 for GET requests', async () => {
      await request(baseUrl)
        .get('/signature')
        .expect(404);
    });

    test('should return 404 for invalid endpoints', async () => {
      await request(baseUrl)
        .post('/invalid')
        .expect(404);
    });

    test('should return 404 for root path', async () => {
      await request(baseUrl)
        .get('/')
        .expect(404);
    });
  });
});