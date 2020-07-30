const Signer = require("./index");
const http = require("http");

(async function main() {
  try {
    const signer = new Signer();

    const server = http
      .createServer()
      .listen(8080)
      .on("listening", function () {
        console.log("TikTok Signature server started");
      });

    // Uncomment if you want to auto-exit this application after a period of time
    // If you use PM2 or Supervisord, it will attempt to open it ( in this way tac token will be refreshed)
    // setTimeout(function () {
    //   server.close(() => {
    //     console.log("Server shutdown completed.");
    //     process.exit(1);
    //   });
    // }, 1 * 60 * 60 * 1000);

    //signer.init(); // !?

    signer.init().finally(() => {
      if (!signer.initialized) {
        console.log("seems singer init failed, exiting.");
        process.exit(1);
      }
    }).catch(() => {
      console.log("seems singer init failed, exiting.");
      process.exit(1);
    });

    server.on("request", (request, response) => {
      if (request.method === "POST" && request.url === "/signature") {
        var url = "";
        request.on("data", function (chunk) {
          url += chunk;
        });

        request.on("end", async function () {
          console.log("Received url: " + url);

          try {
            const verifyFp = await signer.getVerifyFp();
            const token = await signer.sign(url);
            const cookies = await signer.getCookies();
            let output = JSON.stringify({
              signature: token,
              verifyFp: verifyFp,
              cookies: cookies
            });
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(output);
            console.log("Sent result: " + output);
          } catch (err) {
            console.log(err);
            if (signer.initialized && err.message.indexOf("Can't find variable: generateSignature") > 0) {
              console.log("singer not really initialized, exiting.");
              process.exit(1);
            }
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
    process.exit(1);
  }
})();
