const Signer = require("./index");

var url = process.argv[2];

(async function main() {
  try {
    const signer = new Signer();
    await signer.init();

    const verifyFp = await signer.verifyFp;
    const token = await signer.sign(url);
    let output = JSON.stringify({
      signature: token,
      verifyFp: verifyFp,
      user_agent: signer.userAgent,
    });
    console.log(output);
    await signer.close();
  } catch (err) {
    console.error(err);
  }
})();
