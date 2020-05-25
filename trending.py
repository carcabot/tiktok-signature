import requests

# type
# VIDEO: 0,
# USER: 1,
# LIKE: 2,
# CHALLENGE: 3,
# MUSIC: 4,
# TRENDING: 5,
# DISCOVER: 6,
# INBOX: 7,
# PROFILE: 8,
# ANALYTICS: 9

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

data = request.text

print(data)
