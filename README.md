# විකසිත ජාතික එකමුතුව — Website

Static website (HTML/CSS/JS, no build step) in Sinhala (default), English and Tamil.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Where to edit things

| What | File |
|---|---|
| All text, in all 3 languages (incl. projects) | `assets/js/i18n.js` |
| Page structure | `index.html` |
| Styles | `assets/css/style.css` |
| Behaviour (language switch, gallery, modal…) | `assets/js/main.js` |
| Hero video / logo | `resource/default.mp4`, `resource/logo.jpeg` |
| Gallery data (generated — don't edit) | `data/gallery.js`, photos in `resource/gallery/fb/` |

## Facebook gallery & deployment

The Gallery shows the Facebook Page's albums **on the website** (album view + photo viewer).

How it works — `.github/workflows/deploy.yml` runs on every push to `main`, daily at 06:00 (Sri Lanka) and on demand:

1. restores previously downloaded photos from the GitHub Actions cache,
2. runs `scripts/sync_facebook.py`, which reads the Page's albums through the official Graph API and downloads only new photos,
3. publishes the site + photos to **GitHub Pages**.

Photos and gallery data (`data/`, `resource/gallery/`) are **never committed** — they are git-ignored and live only in the Actions cache and the published site.

### Keeping the token safe (public repo)

- The Facebook token is stored only as an encrypted **GitHub Actions secret** (`FB_PAGE_TOKEN`). It is never in the code; the script reads it from an environment variable, and GitHub masks it as `***` in logs.
- Secrets are not passed to workflows triggered by pull requests from forks, so outsiders cannot read it.
- The token is a Page token with read-only permissions (`pages_show_list`, `pages_read_engagement`).
- If a token is ever exposed: remove the app in Facebook **Settings → Business integrations** (or reset the App Secret), generate a new token and update the secret.
- Never paste tokens into issues, commits, chat or `.env` files that get committed (`.env` is git-ignored).

### One-time setup on GitHub

1. **Pages:** repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Token secret:** **Settings → Secrets and variables → Actions → New repository secret** → name `FB_PAGE_TOKEN`, value = the Page token (see below).
3. **Run it:** **Actions → "Sync Facebook albums & deploy site" → Run workflow**. The first run downloads all photos (~1–1.5 h); later runs only fetch new ones.

### Getting a Page access token (Page admin)

1. <https://developers.facebook.com/apps> → **Create app** → use case **Other** → type **Business**.
2. **Graph API Explorer** (<https://developers.facebook.com/tools/explorer>): select the app, *User or Page* = **Get User Access Token**, add `pages_show_list` + `pages_read_engagement`, **Generate Access Token**, and **tick the Vikasitha Page** in the popup.
3. **Access Token Debugger** (<https://developers.facebook.com/tools/debug/accesstoken>) → paste → **Extend Access Token** → copy.
4. Back in the Explorer, with that token, run `me/accounts?fields=name,access_token` and copy the Vikasitha `access_token` (starts with `EAA`). The debugger should show **Type: Page, Expires: Never**.

### Running the sync locally (optional)

```sh
FB_PAGE_TOKEN='EAA...' python3 scripts/sync_facebook.py --prune   # full sync
python3 scripts/sync_facebook.py --from-json --max-albums 30 --prune  # trim offline, no token
```

Options: `--max-albums N` (newest N), `--max-photos N` (per album), `--exclude "Album name"`,
`--full-width` / `--thumb-width` (default 1080 / 480). Profile/cover-photo albums are skipped.
