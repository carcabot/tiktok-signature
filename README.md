## Installation

Install `jsdom`

```bash
npm i jsdom
```

## Usage

Now you can generate the token using

```bash
node signature.js "tiktok url" # service url
```
The response should be the token

```sh
root@localhost: VIm6dAAgEBYZFjzZxqkSy1SJu2AAAlc
```

If you cannot succeed with this token, replace `tac` token (`window.tac`) inside `signature.js`.

## Fetch service url

### Explore feed
```
https://www.tiktok.com/share/item/explore/list
```
### Trending or VideoFeed
```
https://www.tiktok.com/share/item/list?secUid=&id=&type=5&count=30&minCursor=0&maxCursor=0&shareUid=
```
### Comments
```
https://www.tiktok.com/share/item/comment/list?id=<owner id here>&count=50&cursor=0
```
### Video feed
```
https://www.tiktok.com/node/video/feed
```


## Testing

You can test it using

```python
import requests

signature = "VIm6dAAgEBYZFjzZxqkSy1SJu2AAAlc"
referer = "https://www.tiktok.com/@user/video/123456789123456789" 

url = "https://www.tiktok.com/share/item/comment/list?id=123456789123456789&count=48&cursor=0" + \
    "&_signature=" + signature # same service url
request = requests.get(url, headers={"method": "GET",
                                "accept-encoding": "gzip, deflate, br",
                                "Referer": referer,
                                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"})

data = request.json()

print(data)
```

## Contributing


If you have a better improvement to this code, let me know ;)

Hope it helps.

## License
[MIT](https://choosealicense.com/licenses/mit/)
