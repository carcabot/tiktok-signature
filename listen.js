import Signer from "./index.js";
import http from "http";

const PORT = process.env.PORT || 8080;

// Server metrics
const startTime = Date.now();
let requestCount = 0;

(async function main() {
  try {
    const signer = new Signer();

    const server = http
      .createServer()
      .listen(PORT)
      .on("listening", function () {
        console.log("TikTok Signature server started on PORT " + PORT);
      });

    // Initialize signer
    console.log("Initializing signer...");
    await signer.init();
    console.log("Signer initialized successfully");

    server.on("request", (request, response) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Headers", "*");
      requestCount++;

      if (request.method === "OPTIONS") {
        response.writeHead(200);
        response.end();
        return;
      }

      // Health check endpoint
      if (request.method === "GET" && request.url === "/health") {
        const uptime = Date.now() - startTime;
        const healthData = {
          status: "healthy",
          uptime: Math.floor(uptime / 1000),
          requestCount: requestCount,
          timestamp: new Date().toISOString()
        };
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(healthData));
        return;
      }

      // Metrics endpoint
      if (request.method === "GET" && request.url === "/metrics") {
        const uptime = Date.now() - startTime;
        const memory = process.memoryUsage();
        const metricsData = {
          requests: {
            total: requestCount,
            rate: requestCount / (uptime / 1000)
          },
          uptime: {
            seconds: Math.floor(uptime / 1000),
            startTime: new Date(startTime).toISOString()
          },
          memory: {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed
          },
          timestamp: new Date().toISOString()
        };
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(metricsData));
        return;
      }

      if (request.method === "POST" && request.url === "/signature") {
        var url = "";
        request.on("data", function (chunk) {
          url += chunk;
        });

        request.on("end", async function () {
          console.log("Received url: " + url);
          const processingStart = Date.now();

          try {
            const sign = await signer.sign(url);
            const navigator = await signer.navigator();
            const processingTime = Date.now() - processingStart;

            let output = JSON.stringify({
              status: "ok",
              data: {
                ...sign,
                navigator: navigator,
              },
              metadata: {
                processingTime: processingTime,
                timestamp: new Date().toISOString()
              }
            });
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(output);
            console.log(`Signature generated in ${processingTime}ms`);
          } catch (err) {
            console.error("Error in signing:", err);

            // Return error response instead of crashing
            const processingTime = Date.now() - processingStart;
            const errorOutput = JSON.stringify({
              status: "error",
              error: {
                message: err.message || "Unknown error",
                code: 500,
                timestamp: new Date().toISOString()
              },
              metadata: {
                processingTime: processingTime,
                timestamp: new Date().toISOString()
              }
            });
            response.writeHead(500, { "Content-Type": "application/json" });
            response.end(errorOutput);
          }
        });
      } else {
        response.statusCode = 404;
        response.end();
      }
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, closing server...');
      await signer.close();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, closing server...');
      await signer.close();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error("Critical error:", err);
    process.exit(1);
  }
})();