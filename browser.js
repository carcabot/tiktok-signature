const Signer = require("./index");

var url = process.argv[2];

(async function main() {
  try {
    const signer = new Signer();
    await signer.init();

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
    console.log(output);
    await signer.close();
  } catch (err) {
    console.error(err);
  }
})();
