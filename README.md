
![NPM](https://img.shields.io/npm/l/tiktok-signature.svg?style=for-the-badge) ![npm](https://img.shields.io/npm/v/tiktok-signature.svg?style=for-the-badge)

## Installation

```bash
npm i tiktok-signature
```
---
<a href="https://www.buymeacoffee.com/carcabot" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-blue.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>
---

## Usage

![](howto.gif)

### Generating signatures dynamically

To generate signatures dynamically this repo comes with an integrated http server (listen.js) which accepts POST requests to http://localhost:8080/signature with url in request body.

You have to start the server

```js
npm start
```

Request signature

```sh
curl -d "https://m.tiktok.com/share/item/list?secUid=&id=&type=5&count=30&minCursor=0&maxCursor=0&shareUid=" http://localhost:8080/signature
```

### Docker

##### Build

```sh
docker build . -t tiktok-signature
```

##### Run

```sh
docker run -p 8080:8080 -v $(pwd):/usr/app tiktok-signature
```
`tac token` can expire and signatures are no longer valid, to avoid this uncomment the following lines in `listen.js`. 

```js
// setTimeout(function () {
//   server.close(() => {
//     console.log("Server shutdown completed.");
//     process.exit(1);
//   });
// }, 1 * 60 * 60 * 1000);
```

### Module

```js
const Signer = require("tiktok-signature"); // Import package

const signer = new Signer(); // Create new signer
await signer.init(); // Create page with. Returns promise

const signature = await signer.sign("tiktok url"); // Get sign for your url. Returns promise
const token = await signer.getVerifyFp(); // Get verification token for your url. Returns promise

await signer.close(); // Close browser. Returns promise
```

You can pass your desired User-Agent and tac on class creation.

```js
new Signer("Mozilla"); // Set User-Agent to Mozilla
new Signer(null, "123"); // Set tac to 123
```

### CLI

Install dependencies

```bash
npm i playwright
```

Now you can generate the token using

```bash
node browser.js "https://m.tiktok.com/api/item_list/?count=30&id=1&type=5&secUid=&maxCursor=1&minCursor=0&sourceType=12&appId=1233"
```

The response token should look like this

```sh
root@localhost: {"signature":"DujjbAAgEBW5rRjddk.Jbw7o4nAAFAo","verifyFp":"verify_kamf6ehv_80g0FE87_GAoN_4PgQ_9w6P_xgcNXK53gx2W"}
```

## Fetch service url

### Trending or VideoFeed

```
https://m.tiktok.com/api/item_list/?count=30&id=1&type=5&secUid=&maxCursor=1&minCursor=0&sourceType=12&appId=1233
```

### Video feed

```
https://m.tiktok.com/node/video/feed
```

## Testing

You can test it using

```python
import requests

signature = "oKxAeAAgEBgX6bvJMQKua6CsQWAAP4r"
verifyFp = ""

referer = "https://www.tiktok.com/@ondymikula/video/6757762109670477061"

url = "https://m.tiktok.com/api/item_list/?count=30&id=1&type=5&secUid=&maxCursor=1&minCursor=0&sourceType=12&appId=1233" + \
    "&verifyFp=" + verifyFp + \
    "&_signature=" + signature
request = requests.get(url, headers={"method": "GET",
                                "accept-encoding": "gzip, deflate, br",
                                "Referer": referer,
                                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"
                                })
data = request.json()
print(data)
```

---

**NOTE**

It's very important that the userAgent be the same when generate and when request for response.

---

<a href="https://www.buymeacoffee.com/carcabot" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-blue.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>
---

## Contributing

If you have a better improvement to this code, let me know ;)

Hope it helps.

## License

[MIT](https://choosealicense.com/licenses/mit/)
