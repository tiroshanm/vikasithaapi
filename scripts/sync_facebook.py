#!/usr/bin/env python3
"""
Sync photo albums from the Vikasitha Api Facebook Page into the website.

What it does
  1. Reads the Page's albums and photos through the official Facebook Graph API.
  2. Downloads each photo (a thumbnail + a large version) into resource/gallery/fb/.
     Photos are stored locally because Facebook image links expire.
  3. Writes data/gallery.js (loaded by the website) and data/gallery.json.

Usage
  FB_PAGE_TOKEN=xxxx python3 scripts/sync_facebook.py
  FB_PAGE_TOKEN=xxxx python3 scripts/sync_facebook.py --max-albums 20 --max-photos 80 --prune
  python3 scripts/sync_facebook.py --from-json --max-albums 30 --prune   # trim offline, no token

Environment
  FB_PAGE_TOKEN     (required) Page access token with pages_read_engagement.
  FB_PAGE_ID        Page id (default: the Vikasitha Page, 1450392655233881).
  FB_GRAPH_VERSION  Graph API version (default v23.0).

Only the Python standard library is used — no installs needed.
"""
import argparse
import datetime as dt
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GRAPH_BASE = os.environ.get("FB_GRAPH_BASE", "https://graph.facebook.com").rstrip("/")
GRAPH_VERSION = os.environ.get("FB_GRAPH_VERSION", "v23.0")
DEFAULT_PAGE_ID = "1450392655233881"  # Vikasitha Jathika Ekamuthuwa (public page id)
USER_AGENT = "vikasitha-gallery-sync/1.0"

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "resource" / "gallery" / "fb"
DATA_DIR = ROOT / "data"

DEFAULT_EXCLUDE = ["profile pictures", "cover photos", "profile picture", "cover photo"]


class GraphError(Exception):
    pass


def log(msg):
    print(msg, flush=True)


def http_get(url, retries=4):
    """GET a URL and return the raw bytes, retrying on rate limits / server errors."""
    delay = 2
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            try:
                err = json.loads(body.decode("utf-8")).get("error", {})
                raise GraphError("HTTP %s: %s (code %s)" % (e.code, err.get("message", body[:200]), err.get("code")))
            except (ValueError, AttributeError):
                raise GraphError("HTTP %s for %s" % (e.code, url.split("?")[0]))
        except urllib.error.URLError as e:
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            raise GraphError("Network error: %s" % e.reason)


def graph(path, token, **params):
    params["access_token"] = token
    url = "%s/%s/%s?%s" % (GRAPH_BASE, GRAPH_VERSION, path.lstrip("/"), urllib.parse.urlencode(params))
    return json.loads(http_get(url).decode("utf-8"))


def graph_paged(path, token, max_items=0, **params):
    """Yield every item of a Graph API edge, following paging.next."""
    data = graph(path, token, **params)
    count = 0
    while True:
        for item in data.get("data", []):
            yield item
            count += 1
            if max_items and count >= max_items:
                return
        nxt = data.get("paging", {}).get("next")
        if not nxt:
            return
        data = json.loads(http_get(nxt).decode("utf-8"))


def pick_image(images, max_width):
    """From Facebook's list of renditions, pick the largest one not wider than max_width."""
    if not images:
        return None
    images = sorted(images, key=lambda i: i.get("width", 0))
    fitting = [i for i in images if i.get("width", 0) <= max_width]
    return fitting[-1] if fitting else images[0]


def download(url, dest):
    """Download url to dest unless it already exists. Returns True if a file was written."""
    if dest.exists() and dest.stat().st_size > 0:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(http_get(url))
    tmp.replace(dest)
    return True


def rel(path):
    return path.relative_to(ROOT).as_posix()


def album_index_entry(a):
    """Album summary for the small index file (no description / photo list)."""
    return {k: a[k] for k in ("id", "name", "date", "count", "cover")}


def write_outputs(data):
    """
    data/gallery.json      full data (reference + input for --from-json)
    data/gallery.js        small index loaded with the page (album names, covers, counts)
    data/albums/<id>.js    description + photos of one album, loaded only when it is opened
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "gallery.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    index = dict(data, albums=[album_index_entry(a) for a in data["albums"]])
    (DATA_DIR / "gallery.js").write_text(
        "/* Generated by scripts/sync_facebook.py — do not edit by hand. */\n"
        "window.FB_GALLERY = " + json.dumps(index, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    album_dir = DATA_DIR / "albums"
    album_dir.mkdir(exist_ok=True)
    wanted = set()
    for a in data["albums"]:
        f = album_dir / ("%s.js" % a["id"])
        wanted.add(f)
        f.write_text(
            "window.FB_ALBUM_LOADED(" + json.dumps(a["id"]) + ","
            + json.dumps({"description": a.get("description", ""), "photos": a["photos"]},
                         ensure_ascii=False, separators=(",", ":")) + ");\n",
            encoding="utf-8",
        )
    for f in album_dir.glob("*.js"):
        if f not in wanted:
            f.unlink()


def prune_images(keep_files):
    removed = 0
    if not IMG_DIR.exists():
        return 0
    for f in IMG_DIR.rglob("*"):
        if f.is_file() and f.resolve() not in keep_files:
            f.unlink()
            removed += 1
    for d in sorted(IMG_DIR.glob("*"), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            shutil.rmtree(d)
    return removed


def limit_albums(albums, args, exclude):
    """Apply exclusions, newest-first ordering and --max-albums / --max-photos."""
    albums = [a for a in albums if (a.get("name") or "").strip().lower() not in exclude]
    albums.sort(key=lambda x: x.get("created") or x.get("created_time") or "", reverse=True)
    if args.max_albums:
        albums = albums[: args.max_albums]
    return albums


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--page-id", default=os.environ.get("FB_PAGE_ID") or DEFAULT_PAGE_ID)
    ap.add_argument("--max-albums", type=int, default=0, help="keep only the N newest albums (0 = all)")
    ap.add_argument("--max-photos", type=int, default=0, help="max photos per album (0 = all)")
    ap.add_argument("--exclude", action="append", default=[],
                    help="album name to skip (repeatable). Profile/cover photo albums are skipped by default.")
    ap.add_argument("--include-profile-albums", action="store_true", help="do not skip profile/cover albums")
    ap.add_argument("--thumb-width", type=int, default=480)
    ap.add_argument("--full-width", type=int, default=1080)
    ap.add_argument("--prune", action="store_true", help="delete downloaded photos that are not in the gallery any more")
    ap.add_argument("--from-json", action="store_true",
                    help="no Facebook access: rebuild/trim the gallery from data/gallery.json and the photos already downloaded")
    args = ap.parse_args()

    exclude = {e.strip().lower() for e in args.exclude}
    if not args.include_profile_albums:
        exclude |= set(DEFAULT_EXCLUDE)

    # ---- offline rebuild / trim -------------------------------------------------
    if args.from_json:
        src = DATA_DIR / "gallery.json"
        if not src.exists():
            log("ERROR: %s not found — run a normal sync first." % rel(src))
            return 2
        data = json.loads(src.read_text(encoding="utf-8"))
        albums = limit_albums(data.get("albums", []), args, exclude)
        keep_files = set()
        for a in albums:
            if args.max_photos:
                a["photos"] = a["photos"][: args.max_photos]
            a["photos"] = [p for p in a["photos"] if (ROOT / p["thumb"]).exists() and (ROOT / p["full"]).exists()]
            a["count"] = len(a["photos"])
            if a["photos"] and not any(p["thumb"] == a["cover"]["thumb"] for p in a["photos"]):
                a["cover"] = {"thumb": a["photos"][0]["thumb"], "full": a["photos"][0]["full"]}
            for p in a["photos"]:
                keep_files.update({(ROOT / p["thumb"]).resolve(), (ROOT / p["full"]).resolve()})
        data["albums"] = [a for a in albums if a["photos"]]
        write_outputs(data)
        removed = prune_images(keep_files) if args.prune else 0
        log("Rebuilt from gallery.json: %d albums, %d photos%s."
            % (len(data["albums"]), sum(a["count"] for a in data["albums"]),
               (", %d files removed" % removed) if args.prune else ""))
        return 0

    # ---- normal sync from Facebook ---------------------------------------------
    token = os.environ.get("FB_PAGE_TOKEN", "").strip()
    if not token:
        log("ERROR: set FB_PAGE_TOKEN (see README.md → 'Facebook gallery').")
        return 2

    try:
        page = graph(args.page_id, token, fields="id,name,link")
        if args.page_id == "me" and "category" not in graph("me", token, fields="category"):
            raise GraphError("this token belongs to a person, not a Page — pass --page-id or use a Page token")
        log("Page: %s (%s)" % (page.get("name"), page.get("id")))

        raw_albums = list(graph_paged(
            "%s/albums" % args.page_id, token,
            fields="id,name,description,count,created_time,updated_time,link,cover_photo{id}",
            limit=100,
        ))
    except GraphError as e:
        log("ERROR talking to Facebook: %s" % e)
        log("Existing gallery data was left unchanged.")
        return 1

    raw_albums = limit_albums([a for a in raw_albums if a.get("count")], args, exclude)

    albums_out = []
    written = 0
    keep_files = set()

    for a in raw_albums:
        name = (a.get("name") or "").strip()
        log("Album: %s (%s photos)" % (name, a.get("count")))
        try:
            photos_raw = list(graph_paged(
                "%s/photos" % a["id"], token,
                fields="id,name,images,created_time,width,height,link",
                limit=100, max_items=args.max_photos,
            ))
        except GraphError as e:
            log("  skipped — %s" % e)
            continue

        album_dir = IMG_DIR / a["id"]
        photos_out = []
        for p in photos_raw:
            thumb = pick_image(p.get("images"), args.thumb_width)
            full = pick_image(p.get("images"), args.full_width)
            if not thumb or not full:
                continue
            t_path = album_dir / ("%s_t.jpg" % p["id"])
            f_path = album_dir / ("%s.jpg" % p["id"])
            try:
                written += download(thumb["source"], t_path)
                written += download(full["source"], f_path)
            except GraphError as e:
                log("  photo %s skipped — %s" % (p["id"], e))
                continue
            keep_files.update({t_path.resolve(), f_path.resolve()})
            photos_out.append({
                "id": p["id"],
                "thumb": rel(t_path),
                "full": rel(f_path),
                "w": full.get("width"),
                "h": full.get("height"),
                "caption": (p.get("name") or "").strip(),
                "date": p.get("created_time"),
            })

        if not photos_out:
            continue

        cover_id = (a.get("cover_photo") or {}).get("id")
        cover = next((p for p in photos_out if p["id"] == cover_id), photos_out[0])
        albums_out.append({
            "id": a["id"],
            "name": name,
            "description": (a.get("description") or "").strip(),
            "date": a.get("updated_time") or a.get("created_time"),
            "created": a.get("created_time"),
            "count": len(photos_out),
            "cover": {"thumb": cover["thumb"], "full": cover["full"]},
            "photos": photos_out,
        })

    albums_out.sort(key=lambda x: x.get("created") or "", reverse=True)
    data = {
        "updated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "page": {"name": page.get("name"), "link": page.get("link")},
        "albums": albums_out,
    }
    write_outputs(data)
    pruned = prune_images(keep_files) if args.prune else 0

    total = sum(a["count"] for a in albums_out)
    log("Done: %d albums, %d photos, %d new files downloaded%s."
        % (len(albums_out), total, written, (", %d old files removed" % pruned) if args.prune else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
