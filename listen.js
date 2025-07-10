import Signer from "./index.js";
import http from "http";
const PORT = process.env.PORT || 8080;
(async function main() {
  try {
    const signer = new Signer();

    const server = http
      .createServer()
      .listen(PORT)
      .on("listening", function () {
        console.log("TikTok Signature server started on PORT " + PORT);
      });

    // Uncomment if you want to auto-exit this application after a period of time
    // If you use PM2 or Supervisord, it will attempt to open it
    // setTimeout(function () {
    //   server.close(() => {
    //     console.log("Server shutdown completed.");
    //     process.exit(1);
    //   });
    // }, 1 * 60 * 60 * 1000);

    signer.init();

    server.on("request", (request, response) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Headers", "*");

      if (request.method === "OPTIONS") {
        response.writeHead(200);
        response.end();
        return;
      }

      if (request.method === "POST" && request.url === "/signature") {
        var url = "";
        request.on("data", function (chunk) {
          url += chunk;
        });

        request.on("end", async function () {
          console.log("Received url: " + url);

          try {
            const sign = await signer.sign(url);
            const navigator = await signer.navigator();

            let output = JSON.stringify({
              status: "ok",
              data: {
                ...sign,
                navigator: navigator,
              },
            });
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(output);
            console.log(output);
          } catch (err) {
            console.error("Error in signing:", err);

            // Optional: Exit on error
            server.close(() => {
              console.log("Server closed due to error.");
              process.exit(1);
            });
          }
        });
      } else {
        response.statusCode = 404;
        response.end();
      }
    });

    await signer.close();
  } catch (err) {
    console.error("Critical error:", err);
    process.exit(1); // Exit if the main process throws an error

  }
})();