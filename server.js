const Signer = require("./index");
const http = require("http");
fs = require("fs");

(async function main() {
  try {
    const signer = new Signer();
    const tacToken = await signer.getTac();
    const jsCode = fs.readFileSync("./bytedcode.js").toString();

    if (tacToken) {
      console.log("tac loaded successfully");
    }

    fs.readFile("./index.html", "utf8", function(err, html) {
      if (err) {
        throw err;
      }
      http
        .createServer(function(request, response) {
          html = html.replace("<script>TACTOKEN</script>", tacToken);
          html = html.replace("SIGNATURE_FUNCTION", jsCode);
          response.writeHeader(200, { "Content-Type": "text/html" });
          response.write(html);
          response.end();
        })
        .listen(8080)
        .on("listening", function() {
          console.log("TikTok Signature server started");
        });
    });

    await signer.close();
  } catch (err) {
    console.error(err);
  }
})();
