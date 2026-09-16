# PageWell — Share HTML (Chrome extension)

Share the page you are looking at as a [PageWell](https://pagewell.ai) link:
press the button (or `⌘⇧U` / `Ctrl+Shift+U`) and a link comes back. Press
again on the same page to **update the same link**. No account is needed for a
24-hour link; sign in to keep documents. Local `.md` files render in place.

The Chrome Web Store listing is coming; until then install it from this repository as below.

This repository holds the **built extension only** — its root is the unpacked
extension (`manifest.json` is right here). The source lives in the PageWell
monorepo; every release here is produced by one build there and records where
it came from in `MANIFEST`.

## Install from GitHub

**Without git:** download the zip of the current version —
[`v0.3.2.zip`](https://github.com/pagewellai/pagewell-chrome-extension/archive/refs/tags/v0.3.2.zip) — unzip it, then:

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick the unzipped folder (the one containing `manifest.json`).
3. Pin the PageWell button from the extensions menu if you like.

**With git:**

```bash
git clone --depth 1 https://github.com/pagewellai/pagewell-chrome-extension.git
```

then **Load unpacked** the cloned folder. To upgrade: `git pull`, then click
**Reload** on the extension's card in `chrome://extensions`.

To render local Markdown files (`file:///…/notes.md`), also turn on
**Allow access to file URLs** on the extension's card.

## What it asks for

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | read the page you clicked on, only when you click |
| `storage`, `alarms` | remember your links and finish the device-code sign-in |
| `clipboardWrite` | put the link on your clipboard |
| `pagewell.ai` | the API the link is created on |
| `file:///*` | render local `.md` files and inline local assets into a snapshot |
| `*.claudeusercontent.com` (optional) | capture a Claude artifact from inside its frame — asked for only when you share one |

Snapshots are self-contained: linked stylesheets, scripts and images are
inlined at capture time, nothing in the shared page points back at the
original site.

## Releases

`v0.3.2` — built from PageWell `774eefb` at `2026-09-16T05:17:02Z`. Every release
is a tag here (`v<version>`, the same number as `manifest.json`); the zip
GitHub makes for the tag is the extension, ready to load. What changed is in
[`CHANGELOG.md`](CHANGELOG.md).

## Licence

Apache-2.0 — see [`LICENSE`](LICENSE).
