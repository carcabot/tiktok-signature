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

signature = "_02B4Z6wo005012mQuwQAAIDBWcaMkEQAZ7tpsL-AALrr12"
verifyFp = "verify_knvmujoo_A7MLOdfj_h5QN_4lQw_BPrT_e2TsEOWCwSEP"

referer = "https://www.tiktok.com/@ondymikula/video/6847563020290346245"

url = "https://www.tiktok.com/api/post/item_list/?aid=1988&count=30&secUid=MS4wLjABAAAAOUoQXeHglWcq4ca3MwlckxqAe-RIKQ1zlH9NkQkbLAT_h1_6SDc4zyPdAcVdTWZF&cursor=0&verifyFp=verify_knvmujoo_A7MLOdfj_h5QN_4lQw_BPrT_e2TsEOWCwSEP" + \
    "&_signature=" + signature

request = requests.get(url, headers={"method": "GET",
                                     "accept-encoding": "gzip, deflate",
                                     "cookie": "tt_webid_v2=1234567890;",
                                     "Referer": referer,
                                     "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.36"
                                     })

data = request.text

print(data)
