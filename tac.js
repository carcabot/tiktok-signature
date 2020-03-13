const Signer = require("./index");

(async function main() {
  try {
    const signer = new Signer();

    const tacToken = await signer.getTac();
    console.log(tacToken.toString());
    await signer.close();
  } catch (err) {
    console.error(err);
  }
})();
