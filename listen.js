const Signer = require("./index");
const http = require("http");

(async function main() {
  try {
    const signer = new Signer();

    const server = http
      .createServer()
      .listen(8080, "127.0.0.1")
      .on("listening", function() {
        console.log("TikTok Signature server started");
      });


    server.on("request", (request, response) => {
      if (request.method === "POST" && request.url === "/signature") {
        var url = "";
        request.on("data", function(chunk) {
          url += chunk;
        });

        request.on("end", async function() {
          console.log("Received url: " + url);

          await signer.init(); 
          try {
            const token = await signer.sign(url);
            response.writeHead(200);
            response.end(token);
            console.log("Sent signature: " + token);
          } catch (err) {
            console.log(err);
          }

          await signer.close();
        });
      } else {
        response.statusCode = 404;
        response.end();
      }
    });
  } catch (err) {
    console.error(err);
  }
})();
