const Signer = require('./index')

var url = process.argv[2];

(async function main() {
    try {
        const signer = new Signer()
        await signer.init()

        const token = await signer.sign(url)
        console.log(token)
        await signer.close()
    } catch (err) {
        console.error(err);
    }

})();
