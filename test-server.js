import http from 'http';

const PORT = 8080;

// Mock signature server for testing the examples
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    const health = {
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      requestCount: 1,
      timestamp: new Date().toISOString(),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  if (req.method === 'POST' && req.url === '/signature') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log('Received signature request for:', body);

      // Generate mock signature response
      const response = {
        status: 'ok',
        data: {
          signature: '_02B4Z6wo00f01DBbvBwAAIBCcuSZt1Pua8AwS7iAAGyZ6e',
          verify_fp: 'verify_knvz9j2k_miXwiqOy_msam_42g2_BYoa_e4EAbuQnDwqI',
          signed_url: body + '&verifyFp=verify_knvz9j2k_miXwiqOy_msam_42g2_BYoa_e4EAbuQnDwqI&_signature=_02B4Z6wo00f01DBbvBwAAIBCcuSZt1Pua8AwS7iAAGyZ6e&X-Bogus=DFSzswVLXdxANGP5CtmFF2lUrn/4',
          'x-tt-params': 'EgoyMDIzMDYyOAobCkNCUjB4Uk1rNHJhRElOTWZrSTBYVGNEUGNEMFZGSkZ4UXlEUEpWTWZrSTBYVGNFU',
          'x-bogus': 'DFSzswVLXdxANGP5CtmFF2lUrn/4',
          navigator: {
            deviceScaleFactor: 2,
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            browser_language: 'en-US',
            browser_platform: 'MacIntel',
            browser_name: 'Mozilla',
            browser_version: '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
          }
        },
        metadata: {
          processingTime: Math.floor(Math.random() * 500) + 100,
          timestamp: new Date().toISOString()
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      console.log('✅ Mock signature response sent');
    });

    return;
  }

  // 404 for any other endpoint
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', error: { message: 'Not found', code: 404 } }));
});

server.listen(PORT, () => {
  console.log(`🚀 Mock TikTok Signature Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Signature endpoint: http://localhost:${PORT}/signature`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mock server...');
  server.close(() => {
    console.log('✅ Mock server closed');
    process.exit(0);
  });
});