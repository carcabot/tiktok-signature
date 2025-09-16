import http from "http";
import Signer from "./signer.js";
import { config } from "./config.js";
import { ValidationError } from "./validators.js";
import logger from "./logger.js";

class SignatureServer {
  constructor() {
    this.signer = null;
    this.server = null;
    this.requestCount = 0;
    this.startTime = Date.now();
  }

  async start() {
    try {
      logger.info('Starting TikTok Signature Server...');

      this.signer = new Signer();
      await this.signer.init();

      this.server = http.createServer(this.handleRequest.bind(this));

      this.server.listen(config.server.port, () => {
        logger.info(`TikTok Signature server started on PORT ${config.server.port}`);
      });

      this.setupShutdown();
      this.setupHealthCheck();

      return this.server;
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  handleRequest(request, response) {
    this.setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(200);
      response.end();
      return;
    }

    const startTime = Date.now();
    this.requestCount++;

    logger.info(`Request received: ${request.method} ${request.url}`, {
      requestId: this.requestCount,
      userAgent: request.headers['user-agent'],
    });

    if (request.url === '/health') {
      this.handleHealthCheck(response);
      return;
    }

    if (request.url === '/metrics') {
      this.handleMetrics(response);
      return;
    }

    if (request.method === "POST" && request.url === "/signature") {
      this.handleSignatureRequest(request, response, startTime);
      return;
    }

    this.handleNotFound(response);
  }

  setCorsHeaders(response) {
    response.setHeader("Access-Control-Allow-Origin", config.server.cors.origin);
    response.setHeader("Access-Control-Allow-Headers", config.server.cors.headers);
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }

  async handleSignatureRequest(request, response, startTime) {
    let url = "";
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", async () => {
      try {
        url = Buffer.concat(chunks).toString();

        if (!url) {
          throw new ValidationError('Request body is empty');
        }

        if (url.length > 2048) {
          throw new ValidationError('URL is too long');
        }

        logger.info('Processing signature request', { url });

        const sign = await this.signer.sign(url);
        const navigator = await this.signer.navigator();

        const responseData = {
          status: "ok",
          data: {
            ...sign,
            navigator: navigator,
          },
          metadata: {
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        };

        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(responseData));

        logger.info('Signature generated successfully', {
          processingTime: responseData.metadata.processingTime,
          requestId: this.requestCount,
        });
      } catch (error) {
        this.handleError(error, response);
      }
    });

    request.on("error", (error) => {
      logger.error('Request stream error', error);
      this.handleError(error, response);
    });
  }

  handleError(error, response) {
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof ValidationError) {
      statusCode = error.statusCode || 400;
      errorMessage = error.message;
      logger.warn('Validation error', { error: errorMessage });
    } else {
      logger.error('Server error', error);
    }

    const errorResponse = {
      status: 'error',
      error: {
        message: errorMessage,
        code: statusCode,
        timestamp: new Date().toISOString(),
      },
    };

    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(errorResponse));
  }

  handleHealthCheck(response) {
    const health = {
      status: 'healthy',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      requestCount: this.requestCount,
      timestamp: new Date().toISOString(),
    };

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(health));
  }

  handleMetrics(response) {
    const metrics = {
      requests: {
        total: this.requestCount,
        rate: this.requestCount / ((Date.now() - this.startTime) / 1000),
      },
      uptime: {
        seconds: Math.floor((Date.now() - this.startTime) / 1000),
        startTime: new Date(this.startTime).toISOString(),
      },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(metrics));
  }

  handleNotFound(response) {
    const errorResponse = {
      status: 'error',
      error: {
        message: 'Endpoint not found',
        code: 404,
      },
    };

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify(errorResponse));
  }

  setupShutdown() {
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      if (this.signer) {
        await this.signer.close();
        logger.info('Signer closed');
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });
  }

  setupHealthCheck() {
    setInterval(async () => {
      try {
        if (this.signer && !this.signer.isInitialized) {
          logger.warn('Signer not initialized, attempting to reinitialize...');
          await this.signer.init();
        }
      } catch (error) {
        logger.error('Health check failed', error);
      }
    }, 60000);
  }

  async stop() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }

    if (this.signer) {
      await this.signer.close();
    }
  }
}

export default SignatureServer;