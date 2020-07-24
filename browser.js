const Signer = require('./index')

var url = process.argv[2];

(async function main() {
    try {
        const signer = new Signer()
        await signer.init()

        const verifyFp = await signer.getVerifyFp();
        const token = await signer.sign(url)
        const cookies = await signer.getCookies();
        let output = JSON.stringify({
            signature: token,
            verifyFp: verifyFp,
            cookies: cookies
          });
        console.log(output)
        await signer.close()
    } catch (err) {
        console.error(err);
    }

})();
