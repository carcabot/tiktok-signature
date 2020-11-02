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

signature = "_02B4Z6wo00f01QlfOwwAAIBBUL8i4v.mws0JXj-AAB1R0c"
verifyFp = "verify_kcxpglhh_ImVYPYCc_KZyz_4zwO_BnDt_TLuLcCCMD6Ob"

referer = "https://www.tiktok.com/@ondymikula/video/6847563020290346245"

url = "https://m.tiktok.com/share/item/list?secUid=&id=19274&type=3&count=30&minCursor=0&maxCursor=0&shareUid=&recType=&lang=" + \
    "&verifyFp=" + verifyFp + \
    "&_signature=" + signature

request = requests.get(url, headers={"method": "GET",
                                     "accept-encoding": "gzip, deflate, br",
                                     "cookie": "tt_webid_v2=1234567890",
                                     "Referer": referer,
                                     "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36"
                                     })

data = request.text

print(data)
