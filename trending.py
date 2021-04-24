import json
import requests
from Naked.toolshed.shell import muterun_js

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


referer = "https://www.tiktok.com/@ondymikula/video/6847563020290346245"
url = "https://www.tiktok.com/api/post/item_list/?aid=1988&count=30&secUid=MS4wLjABAAAAOUoQXeHglWcq4ca3MwlckxqAe-RIKQ1zlH9NkQkbLAT_h1_6SDc4zyPdAcVdTWZF&cursor=0"

response = muterun_js('browser.js "'+url+'"')

if response.exitcode == 0:
    # the command was successful, handle the standard output
    signature = json.loads(response.stdout)
    print(signature)
    request = requests.get(signature['data']['signed_url'], headers={"method": "GET",
                                                                     "accept-encoding": "gzip, deflate",
                                                                     "cookie": "tt_webid_v2=1234567890;",
                                                                     "Referer": referer,
                                                                     "user-agent": signature['data']['navigator']['user_agent']
                                                                     })

    data = request.text

    print(data)
else:
    standard_err = response.stderr
    exit_code = response.exitcode
    print('Cannot run node script ' + exit_code + ': ' + standard_err)
