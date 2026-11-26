#!/usr/bin/env python3
"""Publish today's queued Instagram post via the Instagram API (Instagram Login).

Queue layout (one folder per post, named by Korea date):
    instagram/queue/YYYY-MM-DD/
        1.jpg [2.jpg ...]   JPEG images, 4:5 (1080x1350) or 1:1. 2-10 images = carousel.
        caption.txt         post caption (UTF-8)

Environment:
    IG_ACCESS_TOKEN   long-lived Instagram user access token (GitHub secret)
    IG_LIVE           "true" to really publish; anything else = dry run
    POST_DATE         optional YYYY-MM-DD override (default: today in Asia/Seoul)
    IMAGE_BASE_URL    public base URL where the repo files are served
                      (default: raw.githubusercontent.com/<repo>/<sha>/)
    GITHUB_REPOSITORY, GITHUB_SHA  set by GitHub Actions

Writes instagram/posted.json (date -> media id) after a live publish.
Uses only the Python standard library.
"""
import datetime as dt
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://graph.instagram.com/v23.0"
ROOT = pathlib.Path(__file__).resolve().parent.parent
QUEUE = ROOT / "instagram" / "queue"
POSTED = ROOT / "instagram" / "posted.json"
KST = dt.timezone(dt.timedelta(hours=9))


def call(method, path, token, **params):
    params["access_token"] = token
    data = urllib.parse.urlencode(params).encode()
    url = path if path.startswith("http") else f"{API}/{path}"
    if method == "GET":
        req = urllib.request.Request(f"{url}?{data.decode()}")
    else:
        req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"Instagram API error {e.code} on {path}: {body}")


def wait_ready(container_id, token):
    for _ in range(30):
        st = call("GET", container_id, token, fields="status_code,status")
        code = st.get("status_code")
        if code == "FINISHED":
            return
        if code in ("ERROR", "EXPIRED"):
            sys.exit(f"Container {container_id} failed: {st}")
        time.sleep(5)
    sys.exit(f"Container {container_id} not ready after 150s")


def main():
    date = os.environ.get("POST_DATE") or dt.datetime.now(KST).date().isoformat()
    folder = QUEUE / date
    if not folder.is_dir():
        print(f"No post queued for {date}. Nothing to do.")
        return

    posted = json.loads(POSTED.read_text()) if POSTED.exists() else {}
    if date in posted:
        print(f"{date} already posted ({posted[date]}). Skipping.")
        return

    images = sorted(p for p in folder.iterdir() if p.suffix.lower() in (".jpg", ".jpeg"))
    caption = (folder / "caption.txt").read_text(encoding="utf-8").strip()
    if not images:
        sys.exit(f"{folder} has no .jpg images (Instagram accepts JPEG only)")
    if len(images) > 10:
        sys.exit("A carousel takes at most 10 images")
    if len(caption) > 2200:
        sys.exit(f"Caption is {len(caption)} chars; Instagram allows 2200")

    repo = os.environ.get("GITHUB_REPOSITORY", "SETUP-AERO/drone-news-map-Public")
    sha = os.environ.get("GITHUB_SHA", "main")
    base = os.environ.get("IMAGE_BASE_URL") or f"https://raw.githubusercontent.com/{repo}/{sha}/"
    urls = [base + str(p.relative_to(ROOT)).replace(os.sep, "/") for p in images]

    live = os.environ.get("IG_LIVE", "").lower() == "true"
    print(f"Post for {date}: {len(images)} image(s), {len(caption)} chars, live={live}")
    for u in urls:
        print("  image:", u)
    print("----- caption -----\n" + caption + "\n-------------------")

    token = os.environ.get("IG_ACCESS_TOKEN", "")
    if not token:
        if live:
            sys.exit("IG_ACCESS_TOKEN secret is missing")
        print("Dry run without token: checked the queue only.")
        return

    me = call("GET", "me", token, fields="user_id,username")
    ig_id = me["user_id"]
    print(f"Account: @{me.get('username')} ({ig_id})")

    if not live:
        print("Dry run: token works, nothing published. Set repo variable IG_LIVE=true to go live.")
        return

    if len(urls) == 1:
        c = call("POST", f"{ig_id}/media", token, image_url=urls[0], caption=caption)
        creation_id = c["id"]
    else:
        children = []
        for u in urls:
            c = call("POST", f"{ig_id}/media", token, image_url=u, is_carousel_item="true")
            wait_ready(c["id"], token)
            children.append(c["id"])
        c = call("POST", f"{ig_id}/media", token, media_type="CAROUSEL",
                 children=",".join(children), caption=caption)
        creation_id = c["id"]
    wait_ready(creation_id, token)
    pub = call("POST", f"{ig_id}/media_publish", token, creation_id=creation_id)
    media_id = pub["id"]
    link = call("GET", media_id, token, fields="permalink").get("permalink", "")
    print(f"Published: {media_id} {link}")

    posted[date] = {"id": media_id, "permalink": link}
    POSTED.write_text(json.dumps(posted, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
