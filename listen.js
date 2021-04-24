const Signer = require("./index");
const http = require("http");
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
                signature: sign.signature,
                verify_fp: sign.verify_fp,
                signed_url: sign.signed_url,
                navigator: navigator,
              },
            });
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(output);
            console.log(output);
          } catch (err) {
            console.log(err);
          }
        });
      } else {
        response.statusCode = 404;
        response.end();
      }
    });

    await signer.close();
  } catch (err) {
    console.error(err);
  }
})();
